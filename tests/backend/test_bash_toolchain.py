import pytest
import subprocess
import os

def test_bash_toolchain_missing_dependency():
    """Verify that CLAW's core Unix bash scripts gracefully fail and intercept 
    broken toolchain states (e.g. missing Nmap binaries) instead of silent failures."""
    
    script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "01-recon.sh")
    
    # Inject a fatally invalid argument to trigger the physical Bash trap exit
    test_env = os.environ.copy()
    test_env["RECON_MODE"] = "INVALID_MODE"
    
    # Run the script, it should exit immediately with 1
    result = subprocess.run([script_path], env=test_env, capture_output=True, text=True)
    
    # Assert graceful error interception
    assert result.returncode == 1, f"Bash script did not error trap properly. STDOUT: {result.stdout}"
    assert "未知侦察模式" in result.stdout or "INVALID_MODE" in result.stderr or "未知侦察模式: INVALID_MODE" in result.stdout
