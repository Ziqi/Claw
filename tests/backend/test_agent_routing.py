import pytest
from backend.agent import classify_command

def test_classify_command_danger_red():
    """Test standard dangerous operations map to RED to block execution or raise intent confirmation."""
    red_commands = [
        "rm -rf /",
        "sudo rm -rf /etc",
        "chmod 777 /etc/passwd",
        "echo 'pwned' > /root/.ssh/authorized_keys"
    ]
    for cmd in red_commands:
        assert classify_command(cmd) == "red", f"Failed to classify high-risk payload: {cmd}"

def test_classify_command_nmap_yellow():
    """Test reconnaissance operations map to YELLOW (Operation Pipeline)."""
    yellow_commands = [
        "nmap -sn 192.168.1.1/24",
        "nuclei -u http://example.com",
        "dirb http://10.0.0.5",
        "masscan -p1-65535 10.0.0.1"
    ]
    for cmd in yellow_commands:
        assert classify_command(cmd) == "yellow", f"Failed to classify recon payload: {cmd}"

def test_classify_command_green():
    """Test harmless / read-only status and API queries map to GREEN."""
    green_commands = [
        "ping -c 4 8.8.8.8",
        "whoami",
        "ifconfig",
        "ls -la"
    ]
    for cmd in green_commands:
        assert classify_command(cmd) == "green", f"Failed to classify safe payload: {cmd}"
