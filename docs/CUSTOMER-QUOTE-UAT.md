# Single-PDF customer quotation - local UAT only

Branch `dev/customer-quotation-pack`; live baseline `357536e` is unchanged.
Do not deploy or push until the owner explicitly approves publication.

## Staff flow

1. Quote & BOM (or Export) -> Create customer quotation pack.
2. Upload 1-8 rendered JPG/PNG/WebP images, at most 15 MB / 40 MP each.
   Preview the light LUXUS watermark, caption and reorder. Originals are untouched.
3. Enter customer, quote reference, revision, dates, a single package selling
   price, tax treatment, explicit inclusions/exclusions and optional extras.
   Selected extras increase total; unselected extras are listed as not included.
4. Review internal warnings, payment/bank details and editable conditions.
   Source defaults: 85% advance, 30-day production after prerequisites.
   Owner approval of commercial wording is required; no legal adequacy is claimed.
5. Confirm the review checkbox and generate. Open Preview PDF before sending.
6. Download or Share ONE PDF. All renders are embedded and watermarked.
   No ZIP, separate JPG, project JSON or internal supplier/BOM/margin data is sent.

## Persistence / limits

Quote details save in the existing project document/draft; use the normal project
Save action for cloud persistence. Images and generated PDFs are session-only.
Download before closing, and re-upload images after reopening. No new storage,
auth, database, pricing or kitchen solver behaviour is introduced.
Quote references are editable draft IDs, not a reserved accounting sequence.
English text only for the current PDF font; unsupported characters are blocked.
Tax treatment is explicit text; package/option prices are final amounts under that
stated treatment. No tax rate or additional tax amount is silently calculated.
Share uses the device's share sheet if supported, otherwise download/attach.

## Checks before live approval

- Confirm logo/contact/payee/bank details against current business records.
- Owner approves non-refundable advance wording and payment timing; review locally
  with an appropriate adviser before using as binding business conditions.
- Ensure scope overrides standard exclusions; no contradictory worktop/install lines.
- Enter actual customer reference, date, valid-until and final price.
- Confirm selected options are not already included in the package.
- Test portrait/landscape renders and a wide/panoramic image; no clipping or crop.
- Test mobile uploads, invalid formats, retry, reorder, removal and captions.
- Edit after generation: old download/share must disappear until regenerated.
- Close/reopen: details retained when saved; images explicitly require re-upload.
- Check direct sharing sends one PDF only; cancellation is not reported as failure.
- Reconcile total, advance and balance; verify no purchasing values appear in PDF.
- Test project save/reopen and existing kitchen edits without regressions.

Automated tests cover pricing/validation/privacy/project round-trip/PDF pagination/
watermark drawing. PDF format proof is visually inspected. Interactive browser,
phone sharing and real-customer UAT remain required before live release.
