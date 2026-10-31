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


    def test_transport_failure_matrix_and_cleanup(self):
        import subprocess
        scratch = "/tmp/sanctifi-publish.ABC12345"
        for failure in ("ssh", "apk", "manifest", "blocked"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temp:
                root = pathlib.Path(temp)
                apk = root / f"sanctifi-{CODE}.apk"
                apk.write_bytes(b"test")
                manifest = root / "candidate.json"
                data = candidate()
                data["sha256"] = publisher.digest(apk)
                manifest.write_text(json.dumps(data))
                argv = ["publish-alpha.py", "--code", str(CODE),
                        "--manifest", str(manifest), "--execute"]
                ssh_results = ([subprocess.CalledProcessError(255, "ssh")]
                               if failure == "ssh" else
                               [mock.Mock(stdout=scratch + "\n"), mock.Mock(returncode=0)])
                transfers = ([subprocess.CalledProcessError(1, "scp")]
                             if failure == "apk" else
                             [mock.Mock(), subprocess.CalledProcessError(1, "scp")]
                             if failure == "manifest" else
                             [mock.Mock(), mock.Mock()])
                with mock.patch.object(publisher, "ARCHIVE", root), \
                     mock.patch.object(publisher.sys, "argv", argv), \
                     mock.patch.object(publisher, "remote_preflight") as preflight, \
                     mock.patch.object(publisher.subprocess, "run",
                                       side_effect=ssh_results) as ssh, \
                     mock.patch.object(publisher, "run",
                                       side_effect=transfers) as scp, \
                     mock.patch("builtins.input", return_value="PUBLISH"):
                    with self.assertRaises((subprocess.CalledProcessError, RuntimeError)):
                        publisher.main()
                preflight.assert_called_once_with(CODE, data["sha256"])
                self.assertEqual(scp.call_count, {"ssh": 0, "apk": 1,
                                                   "manifest": 2, "blocked": 2}[failure])
                self.assertEqual(ssh.call_count, 1 if failure == "ssh" else 2)
                if failure != "ssh":
                    self.assertEqual(ssh.call_args.args[0],
                                     ["ssh", publisher.REMOTE, f"rm -rf -- {scratch}"])

    def test_unexpected_remote_scratch_path_refuses_transfer(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            apk = root / f"sanctifi-{CODE}.apk"
            apk.write_bytes(b"test")
            manifest = root / "candidate.json"
            data = candidate()
            data["sha256"] = publisher.digest(apk)
            manifest.write_text(json.dumps(data))
            argv = ["publish-alpha.py", "--code", str(CODE),
                    "--manifest", str(manifest), "--execute"]
            with mock.patch.object(publisher, "ARCHIVE", root), \
                 mock.patch.object(publisher.sys, "argv", argv), \
                 mock.patch.object(publisher, "remote_preflight"), \
                 mock.patch.object(publisher.subprocess, "run",
                                   return_value=mock.Mock(stdout="/tmp/unsafe;rm -rf /\n")), \
                 mock.patch.object(publisher, "run") as scp, \
                 mock.patch("builtins.input", return_value="PUBLISH"):
                with self.assertRaisesRegex(RuntimeError, "Unexpected remote temporary directory"):
                    publisher.main()
            scp.assert_not_called()

    def test_remote_promotion_recovery_invariants(self):
        # Static checks only: do not pretend the privileged remote script was executed.
        source = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("trap 'rm -f -- \"$tmp\"; rm -rf -- \"$scratch\"' EXIT", source)
        self.assertIn('cmp -s "$root/alpha.json" "$backup"', source)
        self.assertIn('mv -T -- "$tmp" "$root/alpha.json"', source)
        self.assertIn('echo "REMOTE_PROMOTED:$code:$sha"', source)
        self.assertIn('raise RuntimeError("Remote promotion disabled', source)


    def test_cleanup_reports_nonzero_ssh_exit(self):
        scratch = "/tmp/sanctifi-publish.ABC12345"
        with mock.patch.object(publisher.subprocess, "run",
                               return_value=mock.Mock(returncode=255)) as ssh, \
             mock.patch.object(publisher.sys, "stderr", new_callable=__import__("io").StringIO) as stderr:
            self.assertFalse(publisher.cleanup_remote_scratch(scratch))
        self.assertIn("WARNING: remote scratch cleanup failed", stderr.getvalue())
        self.assertIn(scratch, stderr.getvalue())
        self.assertEqual(ssh.call_args.args[0],
                         ["ssh", publisher.REMOTE, f"rm -rf -- {scratch}"])

    def test_cleanup_reports_ssh_launch_failure(self):
        scratch = "/tmp/sanctifi-publish.ABC12345"
        with mock.patch.object(publisher.subprocess, "run",
                               side_effect=OSError("ssh missing")), \
             mock.patch.object(publisher.sys, "stderr", new_callable=__import__("io").StringIO) as stderr:
            self.assertFalse(publisher.cleanup_remote_scratch(scratch))
        self.assertIn("ssh missing", stderr.getvalue())


    def test_sandboxed_promotion_success_and_faults(self):
        """Execute the real embedded shell logic against disposable local paths.

        Strip root ownership flags solely for the sandbox. Never contact SSH or
        use the production directory. Failures are injected by PATH wrappers.
        """
        import ast
        import os
        import subprocess
        tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
        main = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
                    and n.name == "main")
        assignment = next(n for n in ast.walk(main)
                          if isinstance(n, ast.Assign)
                          and any(isinstance(t, ast.Name) and t.id == "remote_script"
                                  for t in n.targets))
        template = ast.literal_eval(assignment.value)
        for fault in ("none", "apk-install", "backup", "manifest-install", "promotion", "concurrent-change",
                      "retry-apk", "retry-apk-backup", "conflicting-apk", "conflicting-backup"):
            with self.subTest(fault=fault), tempfile.TemporaryDirectory() as temp:
                root = pathlib.Path(temp) / "client"
                (root / "apks").mkdir(parents=True)
                old = candidate()
                old["versionCode"] = CODE - 1
                old["apkUrl"] = f"{publisher.BASE}/apks/sanctifi-{CODE - 1}.apk"
                old_bytes = (json.dumps(old) + "\n").encode()
                live = root / "alpha.json"
                live.write_bytes(old_bytes)
                scratch = pathlib.Path(temp) / "scratch"
                scratch.mkdir()
                payload = b"test"
                (scratch / "apk").write_bytes(payload)
                new = candidate()
                new["sha256"] = publisher.digest(scratch / "apk")
                (scratch / "manifest.json").write_text(json.dumps(new) + "\n")
                expected_new = (scratch / "manifest.json").read_bytes()
                target = root / "apks" / f"sanctifi-{CODE}.apk"
                backup = root / f"alpha-{CODE - 1}.backup.json"
                if fault in ("retry-apk", "retry-apk-backup", "conflicting-apk"):
                    target.write_bytes(b"other" if fault == "conflicting-apk" else payload)
                if fault in ("retry-apk-backup", "conflicting-backup"):
                    backup.write_bytes(b"other" if fault == "conflicting-backup" else old_bytes)
                bin_dir = pathlib.Path(temp) / "bin"
                bin_dir.mkdir()
                if fault in ("apk-install", "backup", "manifest-install", "promotion", "concurrent-change"):
                    command, match = {
                        "apk-install": ("install", "*/apks/*"),
                        "backup": ("cp", "*"),
                        "manifest-install": ("install", "*/.alpha.json.*"),
                        "promotion": ("mv", "*"),
                        "concurrent-change": ("install", "*/.alpha.json.*"),
                    }[fault]
                    original = subprocess.run(["which", command], check=True,
                                              capture_output=True, text=True).stdout.strip()
                    wrapper = bin_dir / command
                    if fault == "concurrent-change":
                        wrapper.write_text(
                            "#!/bin/sh\n"
                            f"{original} \"$@\" || exit $?\n"
                            f"case \"$*\" in {match}) "
                            f"printf \"%s\\n\" \"{{\\\"changed\\\":true}}\" > {root / 'alpha.json'} ;; esac\n")
                    else:
                        wrapper.write_text(
                            "#!/bin/sh\n"
                            "case \"$*\" in\n"
                            f"  {match}) exit 73 ;;\n"
                            "esac\n"
                            f"exec {original} \"$@\"\n")
                    wrapper.chmod(0o755)
                script = (template.replace("/opt/updates-site/client", str(root))
                          .replace("__CODE__", str(CODE))
                          .replace("__SHA__", new["sha256"])
                          .replace("__SCRATCH__", str(scratch))
                          .replace("install -o root -g root -m 0644",
                                   "install -m 0644"))
                env = os.environ.copy()
                env["PATH"] = str(bin_dir) + os.pathsep + env["PATH"]
                result = subprocess.run(["bash", "-c", script], env=env,
                                        capture_output=True, text=True)
                backup = root / f"alpha-{CODE - 1}.backup.json"
                target = root / "apks" / f"sanctifi-{CODE}.apk"
                self.assertFalse(scratch.exists(), result.stderr)
                self.assertFalse(list(root.glob(".alpha.json.*")))
                if fault in ("none", "retry-apk", "retry-apk-backup"):
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(live.read_bytes(), expected_new)
                    self.assertEqual(target.read_bytes(), payload)
                    self.assertEqual(backup.read_bytes(), old_bytes)
                    self.assertIn("REMOTE_PROMOTED", result.stdout)
                else:
                    self.assertNotEqual(result.returncode, 0, fault)
                    if fault == "concurrent-change":
                        self.assertNotEqual(live.read_bytes(), old_bytes)
                        self.assertIn(b"changed", live.read_bytes())
                    else:
                        self.assertEqual(live.read_bytes(), old_bytes)
                    self.assertNotIn("REMOTE_PROMOTED", result.stdout)
                    if fault == "apk-install":
                        self.assertFalse(target.exists())
                        self.assertFalse(backup.exists())
                    elif fault == "backup":
                        self.assertTrue(target.exists())
                        self.assertFalse(backup.exists())
                    elif fault == "conflicting-apk":
                        self.assertEqual(target.read_bytes(), b"other")
                        self.assertFalse(backup.exists())
                    elif fault == "conflicting-backup":
                        self.assertFalse(target.exists())
                        self.assertEqual(backup.read_bytes(), b"other")
                    else:
                        self.assertEqual(backup.read_bytes(), old_bytes)

    def test_digest(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            p = pathlib.Path(temp) / "test.apk"
            p.write_bytes(b"test")
            self.assertEqual(publisher.digest(p), hashlib.sha256(b"test").hexdigest())


if __name__ == "__main__":
    unittest.main()
