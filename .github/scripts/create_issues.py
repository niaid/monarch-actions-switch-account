import os
import requests
import json

token = os.getenv("GITHUB_TOKEN")
headers = {"Authorization": f"Bearer {token}"}

owner, repo = os.getenv("GITHUB_REPOSITORY").split("/")

query = f"""
{{
  repository(owner:"{owner}", name:"{repo}") {{
    vulnerabilityAlerts(first: 100) {{
      nodes {{
        id
        vulnerableManifestPath
        vulnerableRequirements
        securityAdvisory {{
          description
          references(first: 10) {{
            nodes {{
              url
            }}
          }}
          severity
        }}
        securityVulnerability {{
          package {{
            name
          }}
          firstPatchedVersion {{
            identifier
          }}
        }}
      }}
    }}
  }}
}}
"""

response = requests.post('https://api.github.com/graphql', headers=headers, json={'query': query})
print(response.json())
