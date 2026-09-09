from __future__ import annotations

from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from website.models import GalleryImage

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    raise CommandError("Pillow is required to import gallery photos.") from exc

DEFAULT_DIR = (
    Path(__file__).resolve().parents[3] / "accounts" / "data" / "school-magazine"
)

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def classify_photo(path: Path) -> tuple[str, str]:
    try:
        with Image.open(path) as image:
            width, height = image.size
    except OSError:
        return ("Campus moment", "From the Peace Concept school magazine.")

    if width >= height * 1.15:
        return (
            "Class portrait",
            "Students and staff of Peace Concept International Mission Schools.",
        )
    return (
        "Student portrait",
        "From the Peace Concept school magazine.",
    )


class Command(BaseCommand):
    help = (
        "Import JPEG/PNG photos from the school-magazine folder into the "
        "public gallery (Django media)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dir",
            type=str,
            default=str(DEFAULT_DIR),
            help="Folder of magazine photos",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing gallery items before import",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Count files without writing",
        )

    def handle(self, *args, **options):
        source = Path(options["dir"])
        if not source.exists():
            raise CommandError(f"Magazine folder not found: {source}")

        files = sorted(
            p
            for p in source.iterdir()
            if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES
        )
        if not files:
            raise CommandError(f"No images found in {source}")

        if options["dry_run"]:
            self.stdout.write(f"Would import {len(files)} photos from {source}")
            return

        created = 0
        skipped = 0
        with transaction.atomic():
            if options["clear"]:
                GalleryImage.objects.all().delete()
            existing = set(
                GalleryImage.objects.values_list("image", flat=True)
            )
            for path in files:
                stored_name = f"gallery/{path.name}"
                if stored_name in existing and not options["clear"]:
                    skipped += 1
                    continue
                title, caption = classify_photo(path)
                item = GalleryImage(
                    title=title,
                    caption=caption,
                    is_published=True,
                )
                with path.open("rb") as handle:
                    item.image.save(path.name, File(handle), save=True)
                created += 1
                existing.add(item.image.name)

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {created} gallery photos (skipped {skipped})."
            )
        )
