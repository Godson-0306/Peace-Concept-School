"""PyMySQL shim for Django 6 on DirectAdmin (no mysqlclient/libmysqlclient)."""


def enable_pymysql() -> None:
    import pymysql

    pymysql.install_as_MySQLdb()
    import MySQLdb

    # Django 6.1 requires mysqlclient >= 2.2.1. PyMySQL's MySQLdb alias
    # reports 1.4.6, which fails the version check even though it works.
    MySQLdb.version_info = (2, 2, 1, "final", 0)
    MySQLdb.__version__ = "2.2.1"
