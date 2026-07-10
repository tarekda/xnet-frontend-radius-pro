import React from 'react';
import PageHeader from "@/components/PageHeader";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

const About: React.FC = () => {
  const { t } = useTranslation("screens");
  return (
    <div className="w-full space-y-6 p-6">
      <PageHeader
        title={t("about.title")}
        subtitle={t("about.subtitle")}
        icon={Info}
      />

      <div className="grid md:grid-cols-2 gap-8">
        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-md">
          <h2 className="text-xl font-semibold text-foreground mb-4">Overview</h2>
          <p className="text-muted-foreground mb-4">
            RADIUS Pro is a modern, feature-rich management interface for RADIUS servers. It provides
            comprehensive tools for authentication, authorization, and accounting (AAA) management.
          </p>
          <p className="text-muted-foreground">
            Built with the latest web technologies, RADIUS Pro offers a seamless experience for
            system administrators and network managers.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-md">
          <h2 className="text-xl font-semibold text-foreground mb-4">Key Features</h2>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start">
              <svg className="h-6 w-6 text-primary mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Real-time monitoring and statistics
            </li>
            <li className="flex items-start">
              <svg className="h-6 w-6 text-primary mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              User and group management
            </li>
            <li className="flex items-start">
              <svg className="h-6 w-6 text-primary mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Advanced authentication policies
            </li>
            <li className="flex items-start">
              <svg className="h-6 w-6 text-primary mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Detailed logging and reporting
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-md">
          <h2 className="text-xl font-semibold text-foreground mb-4">Technical Details</h2>
          <div className="space-y-3 text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Version:</span>
              <span className="ml-2">1.0.0</span>
            </div>
            <div>
              <span className="font-medium text-foreground">Framework:</span>
              <span className="ml-2">Next.js + React</span>
            </div>
            <div>
              <span className="font-medium text-foreground">UI Framework:</span>
              <span className="ml-2">Tailwind CSS</span>
            </div>
            <div>
              <span className="font-medium text-foreground">License:</span>
              <span className="ml-2">MIT</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-md">
          <h2 className="text-xl font-semibold text-foreground mb-4">Support</h2>
          <p className="text-muted-foreground mb-4">
            For technical support, feature requests, or bug reports, please visit our support
            channels:
          </p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <a
                href="https://github.com/your-repo/radius-pro"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub Repository
              </a>
            </li>
            <li>
              <a
                href="mailto:support@radiuspro.com"
                className="text-primary hover:underline"
              >
                Email Support
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default About;