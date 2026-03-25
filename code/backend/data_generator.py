"""
Enterprise ITSM Synthetic Data Generator
Generates realistic IT Service Management data including:
- Business Services
- Configuration Items (CMDB)
- Incidents
- Change Requests
- Problem Records
- Knowledge Base Articles

Usage:
    python data_generator.py

Output: ../data/ folder with 7 JSON files (6 entity types + combined_dataset.json)
"""

import json
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any
from dataclasses import dataclass, asdict
import os


@dataclass
class BusinessService:
    id: str
    name: str
    description: str
    criticality: str
    owner: str
    dependent_services: List[str]


@dataclass
class ConfigurationItem:
    id: str
    name: str
    type: str
    description: str
    business_service: str
    dependencies: List[str]
    status: str


@dataclass
class Incident:
    id: str
    number: str
    short_description: str
    detailed_description: str
    priority: str
    impact: str
    urgency: str
    state: str
    affected_ci: str
    created_at: str
    resolved_at: str
    links: Dict[str, List[str]]


@dataclass
class ChangeRequest:
    id: str
    number: str
    short_description: str
    detailed_description: str
    type: str
    risk: str
    affected_cis: List[str]
    state: str
    created_at: str
    implemented_at: str
    links: Dict[str, List[str]]


@dataclass
class ProblemRecord:
    id: str
    number: str
    short_description: str
    detailed_description: str
    root_cause: str
    workaround: str
    affected_cis: List[str]
    state: str
    created_at: str
    resolved_at: str
    links: Dict[str, List[str]]


@dataclass
class KBArticle:
    id: str
    number: str
    title: str
    content: str
    category: str
    tags: List[str]
    created_at: str
    links: Dict[str, List[str]]


class ITSMDataGenerator:
    def __init__(self):
        self.business_services = []
        self.configuration_items = []
        self.incidents = []
        self.change_requests = []
        self.problem_records = []
        self.kb_articles = []

        # Service names
        self.service_names = [
            "E-Commerce Platform", "Payment Gateway", "Customer Portal",
            "Order Management System", "Inventory Management", "CRM System",
            "Email Service", "Authentication Service", "API Gateway",
            "Database Cluster", "Content Delivery Network", "Analytics Platform",
            "Mobile App Backend", "Search Service", "Notification Service",
            "Billing System", "Reporting Service", "Data Warehouse",
            "Integration Hub", "Monitoring Service"
        ]

        # CI types and names
        self.ci_types = ["Server", "Database", "Application", "Network Device", "Load Balancer", "Storage"]
        self.server_names = ["web-server", "app-server", "db-server", "cache-server", "queue-server", "api-server"]

        # Common issues
        self.common_issues = [
            "High CPU usage", "Memory leak", "Database connection timeout",
            "Network latency", "Service unavailable", "Authentication failure",
            "Slow response time", "Data corruption", "Configuration error",
            "Disk space full", "SSL certificate expired", "API rate limit exceeded"
        ]

    def generate_business_services(self, count: int = 20) -> List[BusinessService]:
        """Generate business services"""
        services = []
        for i in range(count):
            service_id = str(uuid.uuid4())
            name = self.service_names[i % len(self.service_names)]

            # Create dependencies between services
            dependent_services = []
            if i > 0:
                num_deps = random.randint(0, min(3, i))
                dependent_services = random.sample([s.id for s in services], num_deps)

            service = BusinessService(
                id=service_id,
                name=name,
                description=f"{name} provides critical business functionality for enterprise operations",
                criticality=random.choice(["Critical", "High", "Medium", "Low"]),
                owner=f"team-{random.randint(1, 10)}@company.com",
                dependent_services=dependent_services
            )
            services.append(service)

        self.business_services = services
        return services

    def generate_configuration_items(self, count: int = 120) -> List[ConfigurationItem]:
        """Generate configuration items"""
        cis = []

        for i in range(count):
            ci_id = str(uuid.uuid4())
            ci_type = random.choice(self.ci_types)
            server_name = random.choice(self.server_names)

            # Assign to business service
            business_service = random.choice(self.business_services).id

            # Create dependencies
            dependencies = []
            if i > 0:
                num_deps = random.randint(0, min(4, i))
                dependencies = random.sample([c.id for c in cis], num_deps)

            ci = ConfigurationItem(
                id=ci_id,
                name=f"{server_name}-{i+1:03d}",
                type=ci_type,
                description=f"{ci_type} supporting business operations",
                business_service=business_service,
                dependencies=dependencies,
                status=random.choice(["Active", "Active", "Active", "Maintenance", "Inactive"])
            )
            cis.append(ci)

        self.configuration_items = cis
        return cis

    def generate_problem_records(self, count: int = 80) -> List[ProblemRecord]:
        """Generate problem records"""
        problems = []

        for i in range(count):
            problem_id = str(uuid.uuid4())
            issue = random.choice(self.common_issues)
            affected_cis = random.sample([ci.id for ci in self.configuration_items], random.randint(1, 3))

            created = datetime.now() - timedelta(days=random.randint(30, 365))
            resolved = created + timedelta(days=random.randint(1, 30)) if random.random() > 0.3 else None

            problem = ProblemRecord(
                id=problem_id,
                number=f"PRB{i+1:07d}",
                short_description=f"{issue} affecting multiple systems",
                detailed_description=(
                    f"Problem investigation for recurring {issue.lower()} incidents. "
                    f"Multiple incidents have been linked to this problem. "
                    f"Root cause analysis is in progress. "
                    f"Affected systems: {', '.join(affected_cis[:2])}."
                ),
                root_cause=f"Root cause identified as {issue.lower()} due to infrastructure misconfiguration",
                workaround=f"Temporary workaround: restart affected services and monitor for recurrence",
                affected_cis=affected_cis,
                state=random.choice(["Open", "In Progress", "Resolved", "Closed"]),
                created_at=created.isoformat(),
                resolved_at=resolved.isoformat() if resolved else None,
                links={"incidents": [], "changes": []}
            )
            problems.append(problem)

        self.problem_records = problems
        return problems

    def generate_change_requests(self, count: int = 200) -> List[ChangeRequest]:
        """Generate change requests"""
        changes = []

        for i in range(count):
            change_id = str(uuid.uuid4())
            issue = random.choice(self.common_issues)
            affected_cis = random.sample([ci.id for ci in self.configuration_items], random.randint(1, 4))

            created = datetime.now() - timedelta(days=random.randint(1, 180))
            implemented = created + timedelta(days=random.randint(1, 14)) if random.random() > 0.2 else None

            # Link to problem records
            linked_problems = []
            if self.problem_records and random.random() > 0.5:
                linked_problems = [random.choice(self.problem_records).id]

            change = ChangeRequest(
                id=change_id,
                number=f"CHG{i+1:07d}",
                short_description=f"Fix {issue.lower()} on affected systems",
                detailed_description=(
                    f"Change request to resolve {issue.lower()} affecting production systems. "
                    f"This change will update configuration and apply patches. "
                    f"Rollback plan is documented. "
                    f"Affected CIs: {len(affected_cis)} systems."
                ),
                type=random.choice(["Standard", "Normal", "Emergency"]),
                risk=random.choice(["Low", "Medium", "High"]),
                affected_cis=affected_cis,
                state=random.choice(["Planned", "In Progress", "Implemented", "Closed", "Cancelled"]),
                created_at=created.isoformat(),
                implemented_at=implemented.isoformat() if implemented else None,
                links={"problems": linked_problems, "cis": affected_cis}
            )
            changes.append(change)

        self.change_requests = changes
        return changes

    def generate_kb_articles(self, count: int = 150) -> List[KBArticle]:
        """Generate knowledge base articles"""
        articles = []

        kb_topics = [
            ("High CPU Usage Resolution", "cpu", ["performance", "server", "monitoring"]),
            ("Memory Leak Troubleshooting Guide", "memory", ["performance", "application", "java"]),
            ("Database Connection Timeout Fix", "database", ["database", "connectivity", "timeout"]),
            ("Network Latency Diagnosis", "network", ["network", "latency", "performance"]),
            ("Service Restart Procedures", "operations", ["operations", "restart", "service"]),
            ("Authentication Failure Resolution", "security", ["security", "authentication", "ldap"]),
            ("Slow Response Time Investigation", "performance", ["performance", "response", "tuning"]),
            ("SSL Certificate Renewal Process", "security", ["security", "ssl", "certificate"]),
            ("Disk Space Management", "storage", ["storage", "disk", "cleanup"]),
            ("API Rate Limit Configuration", "api", ["api", "rate-limit", "configuration"]),
            ("Load Balancer Configuration Guide", "infrastructure", ["load-balancer", "nginx", "ha"]),
            ("Database Backup and Recovery", "database", ["database", "backup", "recovery"]),
            ("Container Health Check Setup", "devops", ["docker", "kubernetes", "health"]),
            ("Log Analysis Best Practices", "operations", ["logging", "elk", "monitoring"]),
            ("Incident Response Playbook", "operations", ["incident", "response", "escalation"]),
        ]

        for i in range(count):
            article_id = str(uuid.uuid4())
            topic_idx = i % len(kb_topics)
            title, category, tags = kb_topics[topic_idx]

            # Link to some CIs
            linked_cis = random.sample([ci.id for ci in self.configuration_items], random.randint(0, 3))

            created = datetime.now() - timedelta(days=random.randint(1, 730))

            article = KBArticle(
                id=article_id,
                number=f"KB{i+1:07d}",
                title=f"{title} - Version {(i // len(kb_topics)) + 1}",
                content=(
                    f"This knowledge base article covers {title.lower()}. "
                    f"Follow these steps to diagnose and resolve the issue: "
                    f"1. Check system logs for error messages. "
                    f"2. Verify resource utilization metrics. "
                    f"3. Apply the recommended configuration changes. "
                    f"4. Monitor the system for 30 minutes after applying the fix. "
                    f"5. Escalate to Level 2 support if the issue persists. "
                    f"Category: {category}. Tags: {', '.join(tags)}."
                ),
                category=category,
                tags=tags,
                created_at=created.isoformat(),
                links={"cis": linked_cis}
            )
            articles.append(article)

        self.kb_articles = articles
        return articles

    def generate_incidents(self, count: int = 800) -> List[Incident]:
        """Generate incidents with realistic relationships"""
        incidents = []

        for i in range(count):
            incident_id = str(uuid.uuid4())
            issue = random.choice(self.common_issues)
            affected_ci = random.choice(self.configuration_items).id

            created = datetime.now() - timedelta(days=random.randint(1, 365))
            resolved = created + timedelta(hours=random.randint(1, 72)) if random.random() > 0.2 else None

            # Build links
            links = {}

            # Link to problem record (20% chance)
            if self.problem_records and random.random() < 0.2:
                problem = random.choice(self.problem_records)
                links["problems"] = [problem.id]
                # Back-link: add this incident to the problem's links
                if incident_id not in problem.links.get("incidents", []):
                    problem.links.setdefault("incidents", []).append(incident_id)

            # Link to change request (25% chance)
            if self.change_requests and random.random() < 0.25:
                change = random.choice(self.change_requests)
                links["changes"] = [change.id]

            # Link to KB article (15% chance)
            if self.kb_articles and random.random() < 0.15:
                kb = random.choice(self.kb_articles)
                links["kb_articles"] = [kb.id]

            # Link to CI
            links["cis"] = [affected_ci]

            incident = Incident(
                id=incident_id,
                number=f"INC{i+1:07d}",
                short_description=f"{issue} on {random.choice(self.server_names)}-{random.randint(1, 50):03d}",
                detailed_description=(
                    f"Incident reported: {issue.lower()} detected on production system. "
                    f"Impact: {random.choice(['Users unable to access service', 'Degraded performance', 'Partial outage', 'Full service outage'])}. "
                    f"Steps taken: Investigated logs, identified root cause, applied fix. "
                    f"Resolution: {random.choice(['Service restarted', 'Configuration updated', 'Patch applied', 'Escalated to vendor'])}."
                ),
                priority=random.choice(["P1", "P1", "P2", "P2", "P3", "P3", "P4"]),
                impact=random.choice(["High", "Medium", "Low"]),
                urgency=random.choice(["High", "Medium", "Low"]),
                state=random.choice(["New", "In Progress", "Resolved", "Closed", "Closed", "Closed"]),
                affected_ci=affected_ci,
                created_at=created.isoformat(),
                resolved_at=resolved.isoformat() if resolved else None,
                links=links
            )
            incidents.append(incident)

        self.incidents = incidents
        return incidents

    def generate_all_data(self):
        """Generate all data in the correct order (respecting dependencies)"""
        print("Generating business services...")
        self.generate_business_services(20)
        print(f"  Generated {len(self.business_services)} business services")

        print("Generating configuration items...")
        self.generate_configuration_items(120)
        print(f"  Generated {len(self.configuration_items)} configuration items")

        print("Generating problem records...")
        self.generate_problem_records(80)
        print(f"  Generated {len(self.problem_records)} problem records")

        print("Generating change requests...")
        self.generate_change_requests(200)
        print(f"  Generated {len(self.change_requests)} change requests")

        print("Generating KB articles...")
        self.generate_kb_articles(150)
        print(f"  Generated {len(self.kb_articles)} KB articles")

        print("Generating incidents...")
        self.generate_incidents(800)
        print(f"  Generated {len(self.incidents)} incidents")

        total = (len(self.business_services) + len(self.configuration_items) +
                 len(self.incidents) + len(self.change_requests) +
                 len(self.problem_records) + len(self.kb_articles))
        print(f"\nTotal documents generated: {total}")

    def save_to_json(self, output_dir: str):
        """Save all generated data to JSON files"""
        os.makedirs(output_dir, exist_ok=True)

        datasets = {
            "business_services.json": self.business_services,
            "configuration_items.json": self.configuration_items,
            "incidents.json": self.incidents,
            "change_requests.json": self.change_requests,
            "problem_records.json": self.problem_records,
            "kb_articles.json": self.kb_articles
        }

        for filename, data in datasets.items():
            filepath = os.path.join(output_dir, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump([asdict(item) for item in data], f, indent=2, ensure_ascii=False)
            print(f"Saved {filename}")

        # Save combined dataset for easy loading
        combined = {
            "business_services": [asdict(item) for item in self.business_services],
            "configuration_items": [asdict(item) for item in self.configuration_items],
            "incidents": [asdict(item) for item in self.incidents],
            "change_requests": [asdict(item) for item in self.change_requests],
            "problem_records": [asdict(item) for item in self.problem_records],
            "kb_articles": [asdict(item) for item in self.kb_articles]
        }

        combined_path = os.path.join(output_dir, "combined_dataset.json")
        with open(combined_path, 'w', encoding='utf-8') as f:
            json.dump(combined, f, indent=2, ensure_ascii=False)
        print(f"Saved combined_dataset.json")


def main():
    """Main execution — saves data to ../data/ relative to this script"""
    generator = ITSMDataGenerator()
    generator.generate_all_data()

    # Save to data folder: one level up from backend/
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "..", "data")
    data_dir = os.path.normpath(data_dir)

    print(f"\nSaving data to: {data_dir}")
    generator.save_to_json(data_dir)
    print("\nData generation complete!")
    print("Next step: run ingest.py to load data into Astra DB")


if __name__ == "__main__":
    main()

