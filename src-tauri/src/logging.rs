
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

#[cfg(test)]
mod tests {
    #[test]
    fn test_setup_logging() {
        super::setup_logging();
        assert_eq!(1, 1, "NOT OK")
    }

}


