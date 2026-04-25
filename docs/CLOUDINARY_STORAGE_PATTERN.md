# Brinn — Cloudinary Storage Pattern

## Structure

```
brinn/{env}/users/{userId}/{special}/{assetType}
brinn/{env}/users/{userId}/{year}/{month}/{entryId}_{assetId}
```

---

## Two Namespaces

### Special — User-Level Assets
```
brinn/{env}/users/{userId}/{special}/{assetType}
```

For assets that belong to the **user**, not an entry.

| `{special}` | `{assetType}` | Description |
|---|---|---|
| `profile` | `avatar` | Profile picture |
| `profile` | `cover` | Cover photo |

`{special}` is extensible — e.g. `exports`, `imports` — for any future user-scoped asset outside the timeline.

Special assets use **fixed `public_id`s**, overwritten in-place on update:
```js
cloudinary.uploader.upload(file, {
  public_id: `brinn/production/users/12345/profile/avatar`,
  overwrite: true,
  invalidate: true,
  type: 'authenticated'
});
```

---

### Timeline — Entry Media
```
brinn/{env}/users/{userId}/{year}/{month}/{entryId}_{assetId}
```

For assets that belong to a **specific entry**, bucketed by date to mirror the app's timeline view.

- `{entryId}` — traces directly to the MongoDB `entries` document
- `{assetId}` — disambiguates multiple assets within the same entry
- `{year}/{month}` — mirrors the timeline view; enables prefix-based listing per month

---

## The Rule

> If the asset belongs to an **entry** → timeline.
> If the asset belongs to the **user** → special.

---

## Key Principles

- **`mediaType` is not a folder** — stored in `entries.media[].media_type` in MongoDB
- **Cloudinary is dumb storage** — MongoDB is the index
- **All assets use `type: authenticated`** — nothing is publicly accessible
- **Signed URLs with short TTLs** for all delivery
- **User deletion** = wipe prefix `brinn/{env}/users/{userId}/` — catches everything

---

## MongoDB Reference

`public_id` is stored back in the `entries` document:

```json
{
  "_id": "entry789",
  "userId": "12345",
  "createdAt": "2026-04-24T10:30:00Z",
  "media": [
    {
      "asset_id": "a1b2",
      "cloudinary_public_id": "brinn/production/users/12345/2026/04/entry789_a1b2",
      "resource_type": "video",
      "media_type": "audio"
    },
    {
      "asset_id": "c3d4",
      "cloudinary_public_id": "brinn/production/users/12345/2026/04/entry789_c3d4",
      "resource_type": "image",
      "media_type": "images"
    }
  ]
}
```

---

## `public_id` Construction

```js
// Timeline asset
const publicId = `brinn/${env}/users/${userId}/${year}/${month}/${entryId}_${assetId}`;

// Special asset
const publicId = `brinn/${env}/users/${userId}/${special}/${assetType}`;
```