from rest_framework.pagination import PageNumberPagination


class FlexiblePagination(PageNumberPagination):
    """Fewer round-trips for portal list UIs (class levels, subjects, etc.)."""

    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 500
