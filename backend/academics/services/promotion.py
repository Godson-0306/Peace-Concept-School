from __future__ import annotations

from accounts.models import StudentProfile
from academics.models import ClassArm, ClassLevel


def promote_students_for_new_session() -> dict:
    """
    Promote every active student one ClassLevel up.
    SS3 students become Ex-Students (inactive, no class arm).
    """
    levels = list(ClassLevel.objects.order_by("order", "name"))
    level_by_id = {level.id: level for level in levels}
    next_level_by_id: dict[int, ClassLevel | None] = {}
    for index, level in enumerate(levels):
        next_level_by_id[level.id] = levels[index + 1] if index + 1 < len(levels) else None

    arms_by_level: dict[int, list[ClassArm]] = {}
    for arm in ClassArm.objects.select_related("class_level").order_by("name"):
        arms_by_level.setdefault(arm.class_level_id, []).append(arm)

    promoted = 0
    graduated = 0
    skipped = 0

    students = (
        StudentProfile.objects.filter(is_active=True, class_arm__isnull=False)
        .select_related("class_arm", "class_arm__class_level")
        .iterator()
    )

    for student in students:
        arm = student.class_arm
        if not arm or not arm.class_level_id:
            skipped += 1
            continue

        next_level = next_level_by_id.get(arm.class_level_id)
        if next_level is None:
            # Top of ladder (SS3) → Ex-Student
            student.is_active = False
            student.class_arm = None
            student.promotion_status = "graduated"
            student.save(
                update_fields=["is_active", "class_arm", "promotion_status", "updated_at"]
            )
            graduated += 1
            continue

        next_arms = arms_by_level.get(next_level.id, [])
        if not next_arms:
            skipped += 1
            continue

        same_letter = next(
            (candidate for candidate in next_arms if candidate.name == arm.name),
            None,
        )
        student.class_arm = same_letter or next_arms[0]
        student.promotion_status = "promoted"
        student.save(update_fields=["class_arm", "promotion_status", "updated_at"])
        promoted += 1

    return {
        "promoted_count": promoted,
        "graduated_count": graduated,
        "skipped_count": skipped,
    }
