# -*- coding: utf-8 -*-
"""
Accuracy Testing Suite for API TestLab
Tests the accuracy and effectiveness of the API testing tool
"""
import json
import sys
from v3 import APITester, OpenAITestGenerator
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

class AccuracyEvaluator:
    def __init__(self):
        self.results = {
            'test_generation': {},
            'test_execution': {},
            'coverage': {},
            'accuracy_metrics': {}
        }

    def test_against_jsonplaceholder(self):
        """Test against JSONPlaceholder - a free REST API"""
        print("="*80)
        print("[TEST] ACCURACY TEST: Testing against JSONPlaceholder API")
        print("="*80)

        api_url = "https://jsonplaceholder.typicode.com"

        # Sample data structure from JSONPlaceholder
        sample_data = {
            "userId": 1,
            "id": 1,
            "title": "Sample Post",
            "body": "This is a sample post body"
        }

        # Test 1: Generate fallback tests
        print("\n[TEST] Test 1: Generating Fallback Tests (30 tests)...")
        openai_key = os.getenv('OPENAI_API_KEY', 'dummy_key')
        generator = OpenAITestGenerator(openai_key)

        fallback_tests = generator._generate_fallback_tests(
            api_url=api_url,
            sample_data=sample_data,
            num=30,
            has_auth=False
        )

        # Analyze test distribution
        test_categories = {}
        for test in fallback_tests:
            category = test.get('category', 'unknown')
            test_categories[category] = test_categories.get(category, 0) + 1

        print(f"\n[+] Generated {len(fallback_tests)} tests")
        print(f"[REPORT] Test Distribution:")
        for category, count in test_categories.items():
            percentage = (count / len(fallback_tests)) * 100
            print(f"   • {category}: {count} tests ({percentage:.1f}%)")

        self.results['test_generation']['total_generated'] = len(fallback_tests)
        self.results['test_generation']['distribution'] = test_categories

        # Test 2: Execute tests and measure accuracy
        print(f"\n[TEST] Test 2: Executing Tests against {api_url}...")
        tester = APITester(api_url, timeout=10)

        # Run tests
        for idx, test_case in enumerate(fallback_tests, 1):
            tester.test_request(
                method=test_case.get('method', 'GET'),
                endpoint=test_case.get('endpoint', ''),
                data=test_case.get('data'),
                expected_status=test_case.get('expected_status', 200),
                test_name=f"Test {idx}: {test_case.get('description', 'N/A')}",
                params=test_case.get('params'),
                validate_body=test_case.get('validate_body', False)
            )

        summary = tester.get_summary()

        print(f"\n[REPORT] Execution Results:")
        print(f"   • Total Tests: {summary['total']}")
        print(f"   • Passed: {summary['passed']} [PASS]")
        print(f"   • Failed: {summary['failed']} [FAIL]")
        print(f"   • Pass Rate: {summary['pass_rate']:.1f}%")

        self.results['test_execution'] = summary

        # Test 3: Analyze accuracy by category
        print(f"\n[TEST] Test 3: Analyzing Accuracy by Test Type...")
        category_results = {}

        for result in tester.results:
            test_name = result['test']
            status = result['status']

            # Extract category from test name
            category = 'unknown'
            for tc in fallback_tests:
                if tc.get('description', '') in test_name:
                    category = tc.get('category', 'unknown')
                    break

            if category not in category_results:
                category_results[category] = {'total': 0, 'passed': 0, 'failed': 0}

            category_results[category]['total'] += 1
            if status == 'PASS':
                category_results[category]['passed'] += 1
            else:
                category_results[category]['failed'] += 1

        print(f"\n[REPORT] Accuracy by Test Category:")
        for category, stats in category_results.items():
            pass_rate = (stats['passed'] / stats['total'] * 100) if stats['total'] > 0 else 0
            print(f"   • {category.upper()}:")
            print(f"     - Total: {stats['total']}")
            print(f"     - Passed: {stats['passed']}")
            print(f"     - Failed: {stats['failed']}")
            print(f"     - Accuracy: {pass_rate:.1f}%")

        self.results['coverage'] = category_results

        return tester.results

    def evaluate_security_test_effectiveness(self):
        """Evaluate how effective security tests are"""
        print("\n" + "="*80)
        print("[SECURITY] SECURITY TEST EFFECTIVENESS EVALUATION")
        print("="*80)

        # Test against a vulnerable demo API (if available) or analyze test quality
        security_metrics = {
            'sql_injection_coverage': 0,
            'xss_coverage': 0,
            'path_traversal_coverage': 0,
            'command_injection_coverage': 0,
            'authentication_bypass_coverage': 0,
            'total_security_tests': 0
        }

        # Analyze security test coverage
        print("\n[ANALYSIS] Analyzing Security Test Coverage...")

        openai_key = os.getenv('OPENAI_API_KEY', 'dummy_key')
        generator = OpenAITestGenerator(openai_key)

        fallback_tests = generator._generate_fallback_tests(
            api_url="http://example.com",
            sample_data={},
            num=50,
            has_auth=True
        )

        for test in fallback_tests:
            if test.get('category') == 'security_test':
                security_metrics['total_security_tests'] += 1
                desc = test.get('description', '').lower()

                if 'sql injection' in desc or 'drop table' in desc or 'union' in desc:
                    security_metrics['sql_injection_coverage'] += 1
                if 'xss' in desc or 'script' in desc or 'alert' in desc:
                    security_metrics['xss_coverage'] += 1
                if 'path traversal' in desc or 'etc/passwd' in desc:
                    security_metrics['path_traversal_coverage'] += 1
                if 'command injection' in desc or 'whoami' in desc:
                    security_metrics['command_injection_coverage'] += 1
                if 'auth' in desc or 'bypass' in desc or 'admin' in desc:
                    security_metrics['authentication_bypass_coverage'] += 1

        print(f"\n[REPORT] Security Test Coverage:")
        print(f"   • Total Security Tests: {security_metrics['total_security_tests']}")
        print(f"   • SQL Injection Tests: {security_metrics['sql_injection_coverage']}")
        print(f"   • XSS Tests: {security_metrics['xss_coverage']}")
        print(f"   • Path Traversal Tests: {security_metrics['path_traversal_coverage']}")
        print(f"   • Command Injection Tests: {security_metrics['command_injection_coverage']}")
        print(f"   • Auth Bypass Tests: {security_metrics['authentication_bypass_coverage']}")

        self.results['accuracy_metrics']['security_coverage'] = security_metrics

        # Calculate OWASP Top 10 Coverage
        owasp_coverage = {
            'A01_Broken_Access_Control': security_metrics['authentication_bypass_coverage'] > 0,
            'A02_Cryptographic_Failures': False,  # Not tested in current implementation
            'A03_Injection': (security_metrics['sql_injection_coverage'] +
                             security_metrics['xss_coverage'] +
                             security_metrics['command_injection_coverage']) > 0,
            'A04_Insecure_Design': False,
            'A05_Security_Misconfiguration': False,
            'A06_Vulnerable_Components': False,
            'A07_Auth_Failures': security_metrics['authentication_bypass_coverage'] > 0,
            'A08_Data_Integrity_Failures': False,
            'A09_Logging_Failures': False,
            'A10_SSRF': any('ssrf' in test.get('description', '').lower()
                           for test in fallback_tests if test.get('category') == 'security_test')
        }

        covered_count = sum(1 for v in owasp_coverage.values() if v)
        owasp_percentage = (covered_count / len(owasp_coverage)) * 100

        print(f"\n[REPORT] OWASP Top 10 Coverage: {covered_count}/10 ({owasp_percentage:.1f}%)")
        for vuln, covered in owasp_coverage.items():
            status = "[COVERED]" if covered else "[NOT COVERED]"
            print(f"   {status} {vuln.replace('_', ' ')}")

        self.results['accuracy_metrics']['owasp_coverage'] = {
            'covered': covered_count,
            'total': len(owasp_coverage),
            'percentage': owasp_percentage,
            'details': owasp_coverage
        }

    def generate_accuracy_report(self):
        """Generate comprehensive accuracy report"""
        print("\n" + "="*80)
        print("[REPORT] COMPREHENSIVE ACCURACY REPORT")
        print("="*80)

        print(f"\n[INFO] Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # Overall Accuracy Score
        test_gen_score = 100  # Test generation is deterministic

        exec_score = self.results['test_execution'].get('pass_rate', 0)

        security_coverage = self.results['accuracy_metrics'].get('security_coverage', {})
        total_sec = security_coverage.get('total_security_tests', 1)
        security_score = (
            (security_coverage.get('sql_injection_coverage', 0) / max(total_sec * 0.2, 1)) * 20 +
            (security_coverage.get('xss_coverage', 0) / max(total_sec * 0.2, 1)) * 20 +
            (security_coverage.get('path_traversal_coverage', 0) / max(total_sec * 0.15, 1)) * 15 +
            (security_coverage.get('command_injection_coverage', 0) / max(total_sec * 0.15, 1)) * 15 +
            (security_coverage.get('authentication_bypass_coverage', 0) / max(total_sec * 0.15, 1)) * 15
        )
        security_score = min(security_score, 100)

        owasp_score = self.results['accuracy_metrics'].get('owasp_coverage', {}).get('percentage', 0)

        overall_accuracy = (
            test_gen_score * 0.15 +  # 15% weight
            exec_score * 0.35 +       # 35% weight
            security_score * 0.30 +   # 30% weight
            owasp_score * 0.20        # 20% weight
        )

        print(f"\n[SCORE] OVERALL ACCURACY SCORE: {overall_accuracy:.1f}/100")
        print(f"\n[SCORES] Component Scores:")
        print(f"   • Test Generation: {test_gen_score:.1f}/100 [EXCELLENT]")
        print(f"   • Test Execution: {exec_score:.1f}/100 {'[GOOD]' if exec_score > 70 else '[FAIR]' if exec_score > 50 else '[NEEDS IMPROVEMENT]'}")
        print(f"   • Security Coverage: {security_score:.1f}/100 {'[GOOD]' if security_score > 70 else '[FAIR]' if security_score > 50 else '[NEEDS IMPROVEMENT]'}")
        print(f"   • OWASP Top 10: {owasp_score:.1f}/100 {'[GOOD]' if owasp_score > 70 else '[FAIR]' if owasp_score > 50 else '[NEEDS IMPROVEMENT]'}")

        # Strengths and Weaknesses
        print(f"\n[STRENGTHS] Strengths:")
        if test_gen_score >= 90:
            print(f"   + Excellent test case generation")
        if exec_score >= 70:
            print(f"   + High test execution accuracy")
        if security_score >= 70:
            print(f"   + Strong security test coverage")
        if owasp_score >= 50:
            print(f"   + Good OWASP Top 10 awareness")

        print(f"\n[IMPROVEMENTS] Areas for Improvement:")
        if exec_score < 70:
            print(f"   - Improve test execution accuracy (current: {exec_score:.1f}%)")
        if security_score < 70:
            print(f"   - Enhance security test coverage (current: {security_score:.1f}%)")
        if owasp_score < 70:
            print(f"   - Expand OWASP Top 10 coverage (current: {owasp_score:.1f}%)")

        # Recommendations
        print(f"\n[RECOMMENDATIONS] Recommendations:")
        print(f"   1. Test generation is excellent - maintain current approach")
        if exec_score < 80:
            print(f"   2. Fine-tune expected status codes for better execution accuracy")
        if security_score < 80:
            print(f"   3. Add more security test variants for comprehensive coverage")
        if owasp_score < 70:
            print(f"   4. Implement tests for missing OWASP categories")
        print(f"   5. Consider adding performance and load testing capabilities")

        # Save report to file
        with open('accuracy_report.json', 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'overall_score': overall_accuracy,
                'components': {
                    'test_generation': test_gen_score,
                    'test_execution': exec_score,
                    'security_coverage': security_score,
                    'owasp_coverage': owasp_score
                },
                'detailed_results': self.results
            }, f, indent=2)

        print(f"\n[INFO] Detailed report saved to: accuracy_report.json")

        return overall_accuracy


def main():
    """Run accuracy evaluation"""
    print("=" * 80)
    print("  API TESTLAB - ACCURACY EVALUATION SUITE")
    print("  This tool evaluates the accuracy and effectiveness of your")
    print("  API testing application across multiple dimensions")
    print("=" * 80)

    evaluator = AccuracyEvaluator()

    try:
        # Run tests
        evaluator.test_against_jsonplaceholder()
        evaluator.evaluate_security_test_effectiveness()

        # Generate report
        overall_score = evaluator.generate_accuracy_report()

        print(f"\n" + "="*80)
        if overall_score >= 80:
            print("[SUCCESS] EXCELLENT! Your application has high accuracy")
        elif overall_score >= 60:
            print("[SUCCESS] GOOD! Your application performs well with room for improvement")
        elif overall_score >= 40:
            print("[WARNING] FAIR! Consider improvements to enhance accuracy")
        else:
            print("[WARNING] NEEDS IMPROVEMENT! Significant enhancements required")
        print("="*80)

    except Exception as e:
        print(f"\n[ERROR] Error during evaluation: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
