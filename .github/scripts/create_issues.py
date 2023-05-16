import os
import requests
import json
from github import Github

token = os.getenv("REPO_TOKEN")
g = Github(token)
headers = {"Authorization": f"Bearer {token}"}

owner, repo_name = os.getenv("GITHUB_REPOSITORY").split("/")
repo = g.get_repo(f"{owner}/{repo_name}")


query = f"""
{{
  repository(owner:"{owner}", name:"{repo_name}") {{
    vulnerabilityAlerts(first: 100) {{
      nodes {{
        number
        state
        createdAt
        dismissedAt
        securityVulnerability {{
          package {{
            name
          }}
          advisory {{
            description
          }}
        }}
      }}
    }}
  }}
}}
"""

response = requests.post('https://api.github.com/graphql', headers=headers, json={'query': query})
data = response.json()

alerts = data["data"]["repository"]["vulnerabilityAlerts"]["nodes"]
created_issues = []
skipped_issues = []

for alert in alerts:
  alert_id = alert["number"]
  state = alert["state"]
  package_name = alert["securityVulnerability"]["package"]["name"]
  description = alert["securityVulnerability"]["advisory"]["description"]
  
  # Create a title for the issue
  issue_title = f"Dependabot Alert #{alert_id} - {package_name} is vulnerable"

  # Check if an issue already exists
  issue_exists = any(issue.title == issue_title for issue in repo.get_issues(state="open"))
  if issue_exists or state != 'OPEN':
    skipped_issues.append(alert_id)
  else:
    # Create a new issue
    repo.create_issue(
      title=issue_title,
      body=description,
      labels=["security"]
    )
    created_issues.append(alert_id)

print(f"Created issue IDs: {created_issues}")
print(f"Skipped issue IDs: {skipped_issues}")