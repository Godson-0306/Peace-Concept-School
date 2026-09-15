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


def activate_session_and_term(
    session: AcademicSession, *, term_number: int = 1
) -> Term:
    """Make this session active and activate the given term within it."""
    ensure_session_terms(session)
    if not session.is_active:
        session.is_active = True
        session.save(update_fields=["is_active"])
    number = term_number if term_number in Term.TermNumber.values else 1
    term = Term.objects.get(session=session, number=number)
    term.is_active = True
    term.save(update_fields=["is_active"])
    return term


def active_session_and_term() -> tuple[AcademicSession | None, Term | None]:
    """Return the school-wide active session and its active term (else First Term)."""
    session = AcademicSession.objects.filter(is_active=True).first()
    if session is None:
        session = AcademicSession.objects.order_by("-start_year", "-id").first()
    if session is None:
        return None, None
    ensure_session_terms(session)
    term = Term.objects.filter(session=session, is_active=True).first()
    if term is None:
        term = Term.objects.filter(session=session, number=1).first()
    return session, term
