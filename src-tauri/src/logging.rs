use env_logger::Builder;
use log::LevelFilter;
use std::env;

pub fn setup_logging() {
    let mut builder = Builder::from_default_env();

    if env::var("RUST_LOG").is_err() {
        builder.filter_level(LevelFilter::Info);
    }

    builder.format_timestamp_millis().init();
}