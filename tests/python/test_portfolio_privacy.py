import unittest

from scripts.validate_portfolio import (
    investment_privacy_issues,
    investment_privacy_risks,
    parse_front_matter_text,
)


class InvestmentPrivacyRiskTests(unittest.TestCase):
    def test_flags_numeric_account_total_return(self) -> None:
        risks = investment_privacy_risks("本账户总收益率：+32.5%")
        self.assertIn("账户总收益", risks)

    def test_flags_numeric_personal_position(self) -> None:
        risks = investment_privacy_risks("我的仓位为35%")
        self.assertIn("个人仓位", risks)

    def test_flags_chinese_numeric_personal_position(self) -> None:
        risks = investment_privacy_risks("我的仓位大约三成")
        self.assertIn("个人仓位", risks)

    def test_flags_spaced_personal_position(self) -> None:
        risks = investment_privacy_risks("当前仓位约 35 %")
        self.assertIn("个人仓位", risks)

    def test_flags_multiline_personal_position(self) -> None:
        risks = investment_privacy_risks("我的仓位\n约为35%")
        self.assertIn("个人仓位", risks)

    def test_flags_numeric_personal_capital(self) -> None:
        risks = investment_privacy_risks("投入本金：100000元")
        self.assertIn("个人金额", risks)

    def test_flags_chinese_numeric_personal_capital(self) -> None:
        risks = investment_privacy_risks("投入本金约十万元")
        self.assertIn("个人金额", risks)

    def test_flags_account_profit_synonym(self) -> None:
        risks = investment_privacy_risks("账户盈利约32.5%")
        self.assertIn("账户总收益", risks)

    def test_allows_position_methodology_count(self) -> None:
        risks = investment_privacy_risks("当前仓位管理分为三层，每层有不同规则。")
        self.assertEqual([], risks)

    def test_allows_account_profit_analysis_outline(self) -> None:
        risks = investment_privacy_risks("账户盈利来源可以分为三点讨论。")
        self.assertEqual([], risks)

    def test_allows_explicit_boundary_statement(self) -> None:
        risks = investment_privacy_risks("不公开账户总收益、金额和仓位。")
        self.assertEqual([], risks)

    def test_allows_company_financial_data(self) -> None:
        risks = investment_privacy_risks("公司本期营业收入达到100亿元。")
        self.assertEqual([], risks)

    def test_requires_completed_human_review(self) -> None:
        issues = investment_privacy_issues(
            {
                "privacy_reviewed": "false",
                "security_disclosure_basis": "not_named",
            },
            "",
        )
        self.assertIn(
            "privacy_reviewed must be true before publishing investment work",
            issues,
        )

    def test_requires_a_specific_security_publication_basis(self) -> None:
        issues = investment_privacy_issues({"privacy_reviewed": "true"}, "")
        self.assertTrue(any("security_disclosure_basis" in issue for issue in issues))

    def test_accepts_a_non_disclosing_publication_basis(self) -> None:
        issues = investment_privacy_issues(
            {
                "privacy_reviewed": "true",
                "security_disclosure_basis": "not_named",
            },
            "没有写出具体标的。",
        )
        self.assertEqual([], issues)

    def test_review_does_not_override_detected_disclosure(self) -> None:
        issues = investment_privacy_issues(
            {
                "privacy_reviewed": "true",
                "security_disclosure_basis": "boundary_met",
            },
            "本账户总收益率：+32.5%",
        )
        self.assertTrue(any("账户总收益" in issue for issue in issues))

    def test_scans_sensitive_text_in_multiline_front_matter(self) -> None:
        fields, body = parse_front_matter_text(
            """---
work_type: investment
privacy_reviewed: true
security_disclosure_basis: not_named
constraints: |
  我的仓位大约三成，具体金额不公开。
---

正文没有敏感数字。
"""
        )

        issues = investment_privacy_issues(fields, body)
        self.assertTrue(any("个人仓位" in issue for issue in issues))

    def test_rejects_duplicate_front_matter_keys(self) -> None:
        with self.assertRaisesRegex(ValueError, "duplicate YAML key"):
            parse_front_matter_text(
                """---
title: first
title: second
---
body
"""
            )


if __name__ == "__main__":
    unittest.main()
