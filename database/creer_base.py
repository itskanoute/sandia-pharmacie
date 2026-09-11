import sqlite3
from pathlib import Path

base = Path(__file__).resolve().parent
db_path = base / "pharmacie.db"
schema_path = base / "schema.sql"

if db_path.exists():
    db_path.unlink()

conn = sqlite3.connect(db_path)
try:
    conn.executescript(schema_path.read_text(encoding="utf-8"))
    cur = conn.cursor()

    print("TABLES:")
    for (name,) in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ):
        print(f" - {name}")

    print("VIEWS:")
    for (name,) in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name"
    ):
        print(f" - {name}")

    roles = [r[0] for r in cur.execute("SELECT code FROM roles")]
    print("ROLES:", roles)

    params = cur.execute(
        "SELECT libelle_devise, fuseau_horaire, jours_alerte_peremption FROM parametres"
    ).fetchone()
    print("PARAMS:", params)
    print("OK — base créée:", db_path)
finally:
    conn.close()
