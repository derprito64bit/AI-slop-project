# Original lockups

The square files these eight schools shipped with: a crest set beside or above
the school's name.

They are kept here because `fetch-logos.mjs` **overwrites**
`public/images/universities/square/<id>.png` with the crest cropped out of them.
Without a copy of the input the script would crop its own output on the second
run and zoom further in every time.

Do not delete these, and do not point anything on the site at them — they are a
build input, not an asset. The crop boxes that read them are in `SOURCES`.
