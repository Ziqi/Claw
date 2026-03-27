import pytest
import os
import tempfile
import importlib.util
from xml.etree.ElementTree import ParseError

# Helper function to dynamically import 02.5-parse.py
def import_module_from_file(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def test_nmap_xml_parser_resilience():
    """Verify that the Nmap XML parser safely explodes with a catchable ParseError instead of memory corruption when evaluating truncated XML payload."""
    script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "02.5-parse.py")
    parse_module = import_module_from_file("parse_nmap_xml", script_path)
    
    dirty_xml = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE nmaprun>
<nmaprun scanner="nmap" args="nmap -p- -sV 10.0.0.1" start="1700000000" version="7.94" xmloutputversion="1.05">
<host starttime="1700000000" endtime="1700000010"><status state="up" reason="user-set" reason_ttl="0"/>
<address addr="10.0.0.1" addrtype="ipv4"/>
<hostnames>
</hostnames>
<ports><port protocol="tcp" portid="22"><state state="open" reason="syn-ack" reason_ttl="0"/><service name="ssh" product="OpenSSH" version="8.2p1 Ubuntu 4ubuntu0.5" extrainfo="Ubuntu Linux; protocol 2.0" method="probed" conf="10"><cpe>cpe:/a:openbsd:openssh:8.2p1</cpe><cpe>cpe:/o:linux:linux_kernel</cpe></service></port>
<!-- XML Truncated Here abruptly due to network loss -->
'''

    # Creating a temp file for the dirty XML
    fd, temp_path = tempfile.mkstemp(suffix=".xml")
    with os.fdopen(fd, 'w') as f:
        f.write(dirty_xml)
        
    try:
        # A parse exception MUST be raised rather than infinite loop or silence.
        with pytest.raises(ParseError):
            parse_module.parse_nmap_xml(temp_path)
    finally:
        os.remove(temp_path)

def test_nmap_xml_parser_empty_fields():
    """Verify the parser safely skips or handles hosts with entirely missing structural components."""
    script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "02.5-parse.py")
    parse_module = import_module_from_file("parse_nmap_xml", script_path)

    # Missing ports array, missing IP type, missing service block
    hollow_xml = '''<?xml version="1.0" encoding="UTF-8"?>
<nmaprun scanner="nmap">
    <host>
        <address addr="10.0.0.2" addrtype="ipv4"/>
        <osmatch name="Linux 2.4.x" />
        <ports>
            <port portid="80" protocol="tcp">
                <state state="open" />
                <!-- Missing Service completely -->
            </port>
        </ports>
    </host>
    <host>
       <!-- Missing everything except address -->
       <address addr="10.0.0.3" addrtype="ipv4"/>
    </host>
</nmaprun>
'''
    fd, temp_path = tempfile.mkstemp(suffix=".xml")
    with os.fdopen(fd, 'w') as f:
        f.write(hollow_xml)
        
    try:
        assets = parse_module.parse_nmap_xml(temp_path)
        assert "10.0.0.2" in assets
        assert assets["10.0.0.2"]["os"] == "Linux 2.4.x"
        assert len(assets["10.0.0.2"]["services"]) == 1
        assert assets["10.0.0.2"]["services"][0]["service"] == "unknown" # Graceful fallback
        
        # 10.0.0.3 has no open ports, the parser explicitly skips it (if ports: evaluate truthiness)
        assert "10.0.0.3" not in assets
    finally:
        os.remove(temp_path)
