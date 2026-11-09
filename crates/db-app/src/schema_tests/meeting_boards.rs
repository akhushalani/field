use super::*;

#[tokio::test]
async fn meeting_board_migration_supports_fresh_and_existing_meetings_without_syncing() {
    assert!(
        !cloudsync_table_registry()
            .iter()
            .any(|table| { table.table_name == "local_meeting_board_revisions" })
    );
    for upgrade in [false, true] {
        let db = Db::connect_memory_plain().await.unwrap();
        if upgrade {
            anlg_db_migrate::migrate(
                &db,
                anlg_db_migrate::DbSchema {
                    steps: migration_steps_before("20261109090000_local_meeting_boards"),
                    validate_cloudsync_table: cloudsync_alter_guard_required,
                },
            )
            .await
            .unwrap();
            sqlx::query("INSERT INTO sessions (id, title) VALUES ('meeting', 'Existing meeting')")
                .execute(db.pool())
                .await
                .unwrap();
        }
        prepare_schema(&db).await.unwrap();
        prepare_schema(&db).await.unwrap();
        if !upgrade {
            sqlx::query("INSERT INTO sessions (id, title) VALUES ('meeting', 'Existing meeting')")
                .execute(db.pool())
                .await
                .unwrap();
        }
        let title: String = sqlx::query_scalar("SELECT title FROM sessions WHERE id = 'meeting'")
            .fetch_one(db.pool())
            .await
            .unwrap();
        assert_eq!(title, "Existing meeting");
        sqlx::query("INSERT INTO local_meeting_board_revisions (id, session_id, revision) VALUES ('board', 'meeting', 1)")
            .execute(db.pool()).await.unwrap();
        sqlx::query("DELETE FROM sessions WHERE id = 'meeting'")
            .execute(db.pool())
            .await
            .unwrap();
        let remaining: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM local_meeting_board_revisions")
                .fetch_one(db.pool())
                .await
                .unwrap();
        assert_eq!(remaining, 0);
    }
}
