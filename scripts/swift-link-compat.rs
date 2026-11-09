use std::{env, path::PathBuf};

// swift-rs assumes the older <arch>-apple-macosx/<configuration> layout.
// SwiftPM's configuration alias also resolves Xcode 27's out/Products layout.
pub fn link_configuration_output(package: &str) {
    let configuration = if env::var("DEBUG").as_deref() == Ok("true") {
        "debug"
    } else {
        "release"
    };
    let output = PathBuf::from(env::var_os("OUT_DIR").expect("Cargo sets OUT_DIR"))
        .join("swift-rs")
        .join(package)
        .join(configuration);
    if output.join(format!("lib{package}.a")).is_file() {
        println!("cargo:rustc-link-search=native={}", output.display());
    }
}
