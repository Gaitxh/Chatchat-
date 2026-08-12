use tauri_plugin_sql::{Migration, MigrationKind};

const DATABASE_URL: &str = "sqlite:chatchat.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_council_history",
            sql: include_str!("../migrations/0001_council_history.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_provider_profiles",
            sql: include_str!("../migrations/0002_provider_profiles.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running ChatChat");
}
