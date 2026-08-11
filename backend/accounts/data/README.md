# Staff roster

Minimal staff directory used by:

```bash
python manage.py import_staff_roster
```

Each entry is only `full_name`, `username`, and `gender`.
Profiles without names, junk accounts (School, ATTENDANCE, demo, Admin, etc.), and blank-name rows are skipped so remaining profiles can be edited later in the portal.

Default password for imported staff: `school`
