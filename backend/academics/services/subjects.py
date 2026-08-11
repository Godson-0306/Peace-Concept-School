from academics.defaults import NURSERY_DAYCARE_LEVELS, NURSERY_DAYCARE_SUBJECTS
from academics.models import ClassLevel, Subject


def sync_nursery_daycare_subjects(*, replace_others: bool = True) -> dict:
    """
    Ensure Day Care, Nursery 1, and Nursery 2 have the canonical subject list.
    When replace_others is True, remove any other subjects on those levels
    (including MaxSub / test placeholders).
    """
    created = 0
    updated = 0
    removed = 0
    levels = ClassLevel.objects.filter(name__in=NURSERY_DAYCARE_LEVELS)
    wanted = set(NURSERY_DAYCARE_SUBJECTS)

    for level in levels:
        keep_ids = []
        for index, name in enumerate(NURSERY_DAYCARE_SUBJECTS, start=1):
            subject, was_created = Subject.objects.get_or_create(
                class_level=level,
                name=name,
                defaults={
                    "subject_type": Subject.SubjectType.SUBJECT,
                    "is_active": True,
                    "order": index,
                },
            )
            if was_created:
                created += 1
            else:
                fields = []
                if subject.order != index:
                    subject.order = index
                    fields.append("order")
                if not subject.is_active:
                    subject.is_active = True
                    fields.append("is_active")
                if subject.subject_type != Subject.SubjectType.SUBJECT:
                    subject.subject_type = Subject.SubjectType.SUBJECT
                    fields.append("subject_type")
                if fields:
                    subject.save(update_fields=fields)
                    updated += 1
            keep_ids.append(subject.id)

        if replace_others:
            qs = Subject.objects.filter(class_level=level).exclude(id__in=keep_ids)
            # Also drop anything not in the canonical name list.
            qs = qs.exclude(name__in=wanted)
            count = qs.count()
            if count:
                qs.delete()
                removed += count

    # Global placeholder cleanup (any class).
    placeholder_qs = Subject.objects.filter(name__istartswith="MaxSub") | Subject.objects.filter(
        name__istartswith="Band Sync"
    )
    placeholder_count = placeholder_qs.count()
    if placeholder_count:
        placeholder_qs.delete()
        removed += placeholder_count

    return {
        "created": created,
        "updated": updated,
        "removed": removed,
        "levels": list(levels.values_list("name", flat=True)),
        "subjects": list(NURSERY_DAYCARE_SUBJECTS),
    }
