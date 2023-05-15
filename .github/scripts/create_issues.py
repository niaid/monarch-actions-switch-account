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
print(response.json())
