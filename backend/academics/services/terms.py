from academics.models import AcademicSession, Term

STANDARD_TERM_NUMBERS = (
    Term.TermNumber.FIRST,
    Term.TermNumber.SECOND,
    Term.TermNumber.THIRD,
)


def ensure_session_terms(session: AcademicSession) -> list[Term]:
    """
    Guarantee a session has exactly First, Second, and Third terms.
    Creates any missing terms and normalizes canonical names.
    """
    terms: list[Term] = []
    for number in STANDARD_TERM_NUMBERS:
        term, _ = Term.objects.get_or_create(
            session=session,
            number=number,
            defaults={"name": Term.TermNumber(number).label},
        )
        canonical = Term.TermNumber(number).label
        if term.name != canonical:
            term.name = canonical
            term.save(update_fields=["name"])
        terms.append(term)
    return terms


def ensure_all_session_terms() -> int:
    """Ensure every academic session has the three standard terms. Returns session count."""
    count = 0
    for session in AcademicSession.objects.all():
        ensure_session_terms(session)
        count += 1
    return count
