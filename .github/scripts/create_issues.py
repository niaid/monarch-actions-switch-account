import os
import requests
import json

token = os.getenv("REPO_TOKEN")
headers = {"Authorization": f"Bearer {token}"}

owner, repo = os.getenv("GITHUB_REPOSITORY").split("/")

query = f"""
{{
  repository(owner:"{owner}", name:"{repo}") {{
    vulnerabilityAlerts(first: 100) {{
      nodes {{
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

for alert in alerts:
  package_name = alert["securityVulnerability"]["package"]["name"]
  description = alert["securityVulnerability"]["advisory"]["description"]

  # Check if an issue already exists
  issue_exists = any(issue.title == package_name for issue in repo.get_issues(state="open"))

  if not issue_exists:
    # Create a new issue
    repo.create_issue(
      title=package_name,
      body=description,
      labels=["security"]
    )