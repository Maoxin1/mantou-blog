import unittest

from scripts.validate_portfolio import investment_privacy_issues, investment_privacy_risks


class InvestmentPrivacyRiskTests(unittest.TestCase):
    def test_flags_numeric_account_total_return(self) -> None:
        risks = investment_privacy_risks("本账户总收益率：+32.5%")
        self.assertIn("账户总收益", risks)

    def test_flags_numeric_personal_position(self) -> None:
        risks = investment_privacy_risks("我的仓位为35%")
        self.assertIn("个人仓位", risks)

    def test_flags_numeric_personal_capital(self) -> None:
        risks = investment_privacy_risks("投入本金：100000元")
        self.assertIn("个人金额", risks)

    def test_allows_explicit_boundary_statement(self) -> None:
        risks = investment_privacy_risks("不公开账户总收益、金额和仓位。")
        self.assertEqual([], risks)

    def test_allows_company_financial_data(self) -> None:
        risks = investment_privacy_risks("公司本期营业收入达到100亿元。")
        self.assertEqual([], risks)

    def test_requires_completed_human_review(self) -> None:
        issues = investment_privacy_issues({"privacy_reviewed": "false"}, "")
        self.assertIn(
            "privacy_reviewed must be true before publishing investment work",
            issues,
        )

    def test_review_does_not_override_detected_disclosure(self) -> None:
        issues = investment_privacy_issues(
            {"privacy_reviewed": "true"},
            "本账户总收益率：+32.5%",
        )
        self.assertTrue(any("账户总收益" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
