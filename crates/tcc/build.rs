#[cfg(target_os = "macos")]
#[path = "../../scripts/swift-link-compat.rs"]
mod swift_link_compat;

fn main() {
    #[cfg(target_os = "macos")]
    {
        swift_rs::SwiftLinker::new("14.2")
            .with_package("tcc-swift", "./swift-lib/")
            .link();
        swift_link_compat::link_configuration_output("tcc-swift");
    }

    #[cfg(not(target_os = "macos"))]
    {
        println!("cargo:warning=Swift linking is only available on macOS");
    }
}
