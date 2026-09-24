Drop property art files here, named exactly after the property's `id` from
`property-manifest.json` — e.g. `core-fs1.png` for "Founders Stall",
`belt-rust-b4.png` for "Rust Claim B4".

Accepted extensions: `.png`, `.jpg`, `.jpeg`, `.webp`.

`upload-property-art.mjs` picks these up automatically by matching filename
to property id — no need to edit the manifest's `image` field by hand unless
a file needs to live somewhere else.
