"""Unit tests for the local, side-effect-free publication validation."""
import importlib.util
import pathlib
import tempfile
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

    def test_digest(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            p = pathlib.Path(temp) / "test.apk"
            p.write_bytes(b"test")
            self.assertEqual(publisher.digest(p), hashlib.sha256(b"test").hexdigest())


if __name__ == "__main__":
    unittest.main()
