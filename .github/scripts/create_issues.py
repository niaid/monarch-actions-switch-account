from github import Github

g = Github(os.getenv("GITHUB_TOKEN"))
repo = g.get_repo("YOUR_ORG/YOUR_REPO")

alerts = repo.get_security_alerts()
for alert in alerts:
    issue_exists = any(issue.title == alert.vulnerable_dependency.package.name for issue in repo.get_issues(state="open"))
    if not issue_exists:
        repo.create_issue(
            title=alert.vulnerable_dependency.package.name,
            body=f"Version: {alert.vulnerable_dependency.affected_range}\nFixed in: {alert.fixed_in}",
            labels=["security"]
        )