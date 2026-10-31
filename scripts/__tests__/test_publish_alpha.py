"""Unit tests for the local, side-effect-free publication validation."""
import importlib.util
import pathlib
import tempfile
from unittest import mock
import json
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "publish-alpha.py"
spec = importlib.util.spec_from_file_location("publish_alpha", SCRIPT)
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)

CODE = 80000190
HASH = "2dd94baa9f8ac44bd228f4a6ea92689138e6c1a1a587b95ea6557b0a99224dc8"


def candidate():
    return {
        "schemaVersion": 1,
        "versionCode": CODE,
        "versionName": "8.1.8",
        "apkUrl": f"{publisher.BASE}/apks/sanctifi-{CODE}.apk",
        "sha256": HASH,
        "releaseNotes": "Release Type grouping",
    }


class ManifestValidationTests(unittest.TestCase):
    def test_valid_candidate(self):
        publisher.manifest_check(candidate(), CODE, HASH)

    def test_reject_wrong_checksum(self):
        d = candidate()
        d["sha256"] = "0" * 64
        with self.assertRaises(ValueError):
            publisher.manifest_check(d, CODE, HASH)

    def test_reject_wrong_code(self):
        d = candidate()
        d["versionCode"] = CODE - 1
        with self.assertRaises(ValueError):
            publisher.manifest_check(d, CODE, HASH)

    def test_reject_noncanonical_url(self):
        d = candidate()
        d["apkUrl"] = "https://example.com/evil.apk"
        with self.assertRaises(ValueError):
            publisher.manifest_check(d, CODE, HASH)

    def test_reject_unknown_fields(self):
        d = candidate()
        d["extra"] = True
        with self.assertRaises(ValueError):
            publisher.manifest_check(d, CODE, HASH)

    def test_reject_boolean_code(self):
        d = candidate()
        d["versionCode"] = True
        with self.assertRaises(ValueError):
            publisher.manifest_check(d, CODE, HASH)

    def test_prepare_manifest_creates_reviewed_json(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            apk = root / f"sanctifi-{CODE}.apk"
            apk.write_bytes(b"test")
            target = root / "candidate.json"
            with mock.patch.object(publisher, "ARCHIVE", root), mock.patch("builtins.input", return_value="YES"):
                publisher.prepare_manifest(CODE, "First line\nSecond line", target)
            result = json.loads(target.read_text())
            self.assertEqual(result["releaseNotes"], "First line\nSecond line")
            self.assertEqual(result["sha256"], publisher.digest(apk))
            self.assertTrue(target.read_text().endswith("\n"))
            with mock.patch.object(publisher, "ARCHIVE", root), mock.patch("builtins.input", return_value="YES"):
                with self.assertRaises(FileExistsError):
                    publisher.prepare_manifest(CODE, "changed", target)

    def test_prepare_manifest_cancelled(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            (root / f"sanctifi-{CODE}.apk").write_bytes(b"test")
            target = root / "candidate.json"
            with mock.patch.object(publisher, "ARCHIVE", root), mock.patch("builtins.input", return_value="no"):
                publisher.prepare_manifest(CODE, "Notes", target)
            self.assertFalse(target.exists())

    def test_empty_notes_rejected(self):
        with self.assertRaises(ValueError):
            publisher.prepare_manifest(CODE, "  ", pathlib.Path("/tmp/unused.json"))

    def test_remote_preflight_read_only_command(self):
        completed = mock.Mock(stdout="LIVE_VERSION: 80000189\nAPK_TARGET: absent\nPREFLIGHT_OK\n")
        with mock.patch.object(publisher.subprocess, "run", return_value=completed) as run:
            publisher.remote_preflight(CODE, HASH)
        argv = run.call_args.args[0]
        self.assertEqual(argv[:2], ["ssh", publisher.REMOTE])
        self.assertNotIn("sudo", argv[2])
        self.assertNotIn("install ", argv[2])
        self.assertNotIn("mv ", argv[2])
        self.assertIn("BACKUP: absent", argv[2])
        self.assertIn("Conflicting backup", argv[2])
        self.assertIn("Symlink backup", argv[2])
        self.assertTrue(run.call_args.kwargs["check"])

    def test_remote_preflight_requires_success_marker(self):
        with mock.patch.object(publisher.subprocess, "run", return_value=mock.Mock(stdout="")):
            with self.assertRaises(RuntimeError):
                publisher.remote_preflight(CODE, HASH)

    def test_remote_preflight_propagates_ssh_failure(self):
        import subprocess
        with mock.patch.object(publisher.subprocess, "run", side_effect=subprocess.CalledProcessError(1, "ssh")):
            with self.assertRaises(subprocess.CalledProcessError):
                publisher.remote_preflight(CODE, HASH)

    def test_execute_preflight_failure_prevents_confirmation_and_transfer(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            apk = root / f"sanctifi-{CODE}.apk"
            apk.write_bytes(b"test")
            checksum = publisher.digest(apk)
            manifest = root / "candidate.json"
            data = candidate()
            data["sha256"] = checksum
            manifest.write_text(json.dumps(data), encoding="utf-8")
            argv = ["publish-alpha.py", "--code", str(CODE),
                    "--manifest", str(manifest), "--execute"]
            with mock.patch.object(publisher, "ARCHIVE", root), \
                 mock.patch.object(publisher.sys, "argv", argv), \
                 mock.patch.object(publisher, "remote_preflight", side_effect=RuntimeError("preflight refused")) as preflight, \
                 mock.patch.object(publisher, "run") as transfer, \
                 mock.patch.object(publisher.subprocess, "run") as transport, \
                 mock.patch("builtins.input") as confirm:
                with self.assertRaisesRegex(RuntimeError, "preflight refused"):
                    publisher.main()
            preflight.assert_called_once_with(CODE, checksum)
            confirm.assert_not_called()
            transfer.assert_not_called()
            transport.assert_not_called()

    def test_digest(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            p = pathlib.Path(temp) / "test.apk"
            p.write_bytes(b"test")
            self.assertEqual(publisher.digest(p), hashlib.sha256(b"test").hexdigest())


if __name__ == "__main__":
    unittest.main()
