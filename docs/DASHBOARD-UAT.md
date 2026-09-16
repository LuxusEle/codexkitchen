# Project workspace business-trial checklist

The fabrication/layout engine is unchanged. This release changes project workflow and interface controls, not production approval of kitchen designs.

## Operator and administrator checks

1. Sign in: Projects dashboard opens, not a kitchen. Operator sees own cloud projects; super-admin sees all projects and Users & activity.
2. Create a named project: Room setup opens. Measure the real room and add openings. Save project, return to Projects, reopen and confirm changes.
3. Rename and duplicate a project. The duplicate has a new identity and belongs to the user making the copy. Attached files remain with the original.
4. Move a project to Trash, then Restore. Design and file records are retained; no permanent-delete button is provided.
5. Open the same project on two devices. Save the first, then save the second. The second must report a revision conflict. Use Save as copy to preserve both versions.
6. Change a project and return to Projects without saving to cloud. Reopen it and choose local recovery or the cloud copy. Opening the cloud copy must retain the previous local changes as a separate recovery draft.
7. Refresh during editing: the dashboard opens. Unsynced changes are available under Local recovery on the same browser/account.
8. Import a JSON file: it opens as a separate local draft, never overwriting the imported file's cloud identity. Save project creates a new cloud record.
9. Switch Light/Dark mode on dashboard and editor; refresh. Preference remains. Customer material colours, 3D views and exported images must not change.
10. Prepare the rendering pack. Copy prompt + all views and paste into the intended chat application. It contains plain-text prompt and one PNG reference sheet. If the chat picks only one format, paste Copy prompt separately. Individual images have Copy image buttons; ZIP retains separate full-resolution views.
11. Sign out. Login screen returns. Sign in as another operator: prior user's projects and drafts are not shown.

## Limits for parallel business use

- Cloud save is explicit; a local recovery message is not a cloud backup. Browser storage can be full or cleared. Use Save project and periodic JSON downloads.
- Trash is reversible and retains storage. Duplicate copies design data, not private attachments.
- Clipboard permissions and pasted formats depend on the browser and target chat. Separate full-resolution images are available in the ZIP and share flow.
- Login-alert email delivery still requires a configured sender; activity records are available in the admin dashboard.
- Continue independent checks of dimensions, fabrication details and quotations before manufacturing or committing customer prices.

Verification performed: unit tests, production build, server-rendered admin/operator dashboard entry checks, isolated Neon UAT branch project CRUD/revision/trash/restore integration. Interactive browser and business-operator acceptance remain to be completed.
