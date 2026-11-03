# Artwork accent pixel fixtures

Seven regression samples from the screenshots attached to
https://github.com/evilnick26/substreamer/issues/74, downloaded 2026-11-03.
Original/server-cached covers were not available. These samples are not original
artwork and cannot validate Android/iOS decoding, resizing, colour management,
the Expo bridge or the installed APK.

Each record identifies the source attachment and SHA-256 of the downloaded JPEG.
To reproduce the RGB data with Pillow 12.3.0:

1. Convert the embedded ICC profile to sRGB using ImageCms.profileToProfile.
2. Crop the interior artwork rectangle (70, 210, 635, 770) in the 707 by
   1536 screenshot. Outer player UI is excluded; part of the small lower-right
   cover status overlay may remain. These are screenshot samples, not clean covers.
3. Resize to 300 by 300 with Image.Resampling.BICUBIC.
4. Sample the centre of each cell of a 16 by 16 grid:
   x=int((column+0.5)*300/16), y=int((row+0.5)*300/16).
5. Store row-major RGB bytes as concatenated hexadecimal in `rgb`; the native
   harness adds alpha 255. No Pillow dependency is needed to run the fixtures.

`neutral` describes expected accent presentation, including muted covers with
no eligible hue bucket. `palette` records both complete gradient variants from
the unmodified Kotlin extractor at c48e6e26031c03ae311aa61e89cc5114a62e20ea.
The three colourful palettes must remain identical; the two formerly null muted
results must become metadata-only neutral results, as the two grey controls
already are. Replace or supplement these samples with original cached covers
when available, and complete the seven-album device acceptance matrix on Futwick.
