use std::{env, fs, os::unix::fs::PermissionsExt, path::PathBuf, process::Command};

fn package_directory(package: &str) -> PathBuf {
    PathBuf::from(env::var_os("OUT_DIR").expect("Cargo sets OUT_DIR"))
        .join("swift-rs")
        .join(package)
}

pub fn prepare_package(package: &str) {
    let directory = package_directory(package);
    let source = directory.join("checkouts/swift-rs/src-swift/lib.swift");
    if !source.is_file() {
        let manifest =
            PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("Cargo sets manifest"));
        let status = Command::new("swift")
            .arg("package")
            .arg("--package-path")
            .arg(manifest.join("swift-lib"))
            .arg("--scratch-path")
            .arg(&directory)
            .arg("resolve")
            .status()
            .expect("resolve Swift bridge dependencies");
        assert!(
            status.success(),
            "Swift bridge dependency resolution failed"
        );
    }
    // Xcode 27 release optimization omits these internal @_cdecl entry points.
    // Expose the pinned implementation to Rust without changing its behavior.
    let original = fs::read_to_string(&source).expect("read pinned SwiftRs runtime");
    let mut patched = original.clone();
    for name in [
        "retainObject",
        "releaseObject",
        "dataFromBytes",
        "stringFromBytes",
    ] {
        let public = format!("\npublic func {name}(");
        patched = patched.replace(&format!("\nfunc {name}("), &public);
        assert!(
            patched.contains(&public),
            "Unsupported SwiftRs export: {name}"
        );
    }
    if patched != original {
        let permissions = fs::metadata(&source)
            .expect("read SwiftRs permissions")
            .permissions();
        let mut writable = permissions.clone();
        writable.set_mode(writable.mode() | 0o200);
        fs::set_permissions(&source, writable).expect("allow owner to patch SwiftRs");
        let result = fs::write(&source, patched);
        fs::set_permissions(&source, permissions).expect("restore SwiftRs permissions");
        result.expect("expose SwiftRs C exports");
    }
}

// swift-rs assumes the older <arch>-apple-macosx/<configuration> layout.
// SwiftPM's configuration alias also resolves Xcode 27's out/Products layout.
pub fn link_configuration_output(package: &str) {
    let configuration = if env::var("DEBUG").as_deref() == Ok("true") {
        "debug"
    } else {
        "release"
    };
    let output = package_directory(package).join(configuration);
    if output.join(format!("lib{package}.a")).is_file() {
        println!("cargo:rustc-link-search=native={}", output.display());
    }
}
