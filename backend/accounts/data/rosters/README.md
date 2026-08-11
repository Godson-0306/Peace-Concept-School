# Student roster imports

Place Peace Concept `User_List*.xlsx` exports in this folder, then run:

```bash
python manage.py import_student_roster
```

Class labels are mapped as:

| Spreadsheet | App class |
|-------------|-----------|
| NURSERYPRE | Day Care |
| NURSERY1 | Nursery 1 |
| NURSERY2 / NURSERY3 | Nursery 2 |
| PRIMARY1–5 | Basic 1–5 |
| JSS1–3 / SS1–3 | same |
| EXSTUDENT | inactive (Ex-Students) |

Students are placed in Arm **A**. Rows whose Name cell is a date (spreadsheet corruption) are skipped.
