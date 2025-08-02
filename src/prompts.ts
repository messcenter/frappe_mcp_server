/**
 * MCP Prompts implementation for Frappe
 * Provides templated messages and workflows for users
 */

import { logger } from './logger.js';
import { findDocTypes, getModuleList } from './frappe-helpers.js';

export interface Prompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface PromptMessage {
  role: "user" | "assistant";
  content: {
    type: "text" | "image";
    text?: string;
    imageUrl?: string;
  };
}

export interface GetPromptResult {
  description?: string;
  messages: PromptMessage[];
}

// Predefined Frappe workflow prompts
export async function listPrompts(): Promise<Prompt[]> {
  const prompts: Prompt[] = [
    {
      name: "analyze_doctype",
      description: "Analyze a DocType structure and suggest improvements",
      arguments: [
        {
          name: "doctype_name",
          description: "Name of the DocType to analyze",
          required: true
        }
      ]
    },
    {
      name: "generate_api_usage",
      description: "Generate API usage examples for a specific DocType",
      arguments: [
        {
          name: "doctype_name", 
          description: "DocType to generate API examples for",
          required: true
        },
        {
          name: "operation",
          description: "API operation (create, read, update, delete, list)",
          required: false
        }
      ]
    },
    {
      name: "design_workflow",
      description: "Design a business workflow using Frappe DocTypes",
      arguments: [
        {
          name: "business_process",
          description: "Description of the business process",
          required: true
        },
        {
          name: "modules",
          description: "Relevant modules to consider (comma-separated)",
          required: false
        }
      ]
    },
    {
      name: "troubleshoot_setup",
      description: "Help troubleshoot Frappe setup or configuration issues",
      arguments: [
        {
          name: "issue_description",
          description: "Description of the issue or error",
          required: true
        },
        {
          name: "module",
          description: "Module where the issue occurs",
          required: false
        }
      ]
    },
    {
      name: "optimize_performance",
      description: "Analyze and suggest performance optimizations",
      arguments: [
        {
          name: "performance_issue",
          description: "Description of performance problem",
          required: true
        },
        {
          name: "doctype_name",
          description: "Specific DocType with performance issues",
          required: false
        }
      ]
    },
    {
      name: "create_custom_report",
      description: "Guide through creating a custom report",
      arguments: [
        {
          name: "report_requirements",
          description: "What data the report should show",
          required: true
        },
        {
          name: "report_type",
          description: "Type of report (query, script, print)",
          required: false
        }
      ]
    },
    {
      name: "integration_planning",
      description: "Plan integration with external systems",
      arguments: [
        {
          name: "external_system",
          description: "External system to integrate with",
          required: true
        },
        {
          name: "integration_type", 
          description: "Type of integration (webhook, api, file)",
          required: false
        }
      ]
    },
    {
      name: "data_migration",
      description: "Plan data migration strategy",
      arguments: [
        {
          name: "source_system",
          description: "Source system for data migration",
          required: true
        },
        {
          name: "target_doctypes",
          description: "Target DocTypes for migration",
          required: false
        }
      ]
    }
  ];

  logger.info(`Available prompts: ${prompts.length}`);
  return prompts;
}

export async function getPrompt(name: string, args: Record<string, any> = {}): Promise<GetPromptResult | null> {
  try {
    switch (name) {
      case "analyze_doctype":
        return await generateDocTypeAnalysisPrompt(args.doctype_name);
        
      case "generate_api_usage":
        return await generateApiUsagePrompt(args.doctype_name, args.operation);
        
      case "design_workflow":
        return await generateWorkflowDesignPrompt(args.business_process, args.modules);
        
      case "troubleshoot_setup":
        return await generateTroubleshootPrompt(args.issue_description, args.module);
        
      case "optimize_performance":
        return await generatePerformancePrompt(args.performance_issue, args.doctype_name);
        
      case "create_custom_report":
        return await generateReportCreationPrompt(args.report_requirements, args.report_type);
        
      case "integration_planning":
        return await generateIntegrationPrompt(args.external_system, args.integration_type);
        
      case "data_migration":
        return await generateMigrationPrompt(args.source_system, args.target_doctypes);
        
      default:
        return null;
    }
  } catch (error) {
    logger.error(`Error generating prompt ${name}:`, error);
    return null;
  }
}

async function generateDocTypeAnalysisPrompt(doctypeName: string): Promise<GetPromptResult> {
  const doctypes = await findDocTypes(doctypeName, { limit: 5 });
  const modules = await getModuleList();
  
  return {
    description: `Analyze the ${doctypeName} DocType structure and suggest improvements`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please analyze the DocType "${doctypeName}" in Frappe and provide insights on:

1. **Field Structure Analysis**
   - Review field types and their appropriateness
   - Check for missing mandatory fields
   - Suggest field naming improvements
   - Identify potential data validation issues

2. **Relationships & Links**
   - Analyze Link fields and their targets
   - Check for circular dependencies
   - Suggest additional relationships that might be useful

3. **Performance Considerations**
   - Review field indexing opportunities
   - Identify heavy computation fields
   - Suggest caching strategies

4. **User Experience**
   - Form layout improvements
   - Field grouping suggestions
   - Workflow enhancements

5. **Best Practices Compliance**
   - Naming conventions
   - Documentation completeness
   - Security considerations

Available DocTypes in system: ${doctypes.map(dt => dt.name).join(', ')}
Available Modules: ${modules.slice(0, 10).join(', ')}

Please provide specific, actionable recommendations.`
        }
      }
    ]
  };
}

async function generateApiUsagePrompt(doctypeName: string, operation?: string): Promise<GetPromptResult> {
  const operations = operation ? [operation] : ['create', 'read', 'update', 'delete', 'list'];
  
  return {
    description: `Generate comprehensive API usage examples for ${doctypeName}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Generate comprehensive API usage examples for the DocType "${doctypeName}" covering these operations: ${operations.join(', ')}.

For each operation, provide:

1. **REST API Examples**
   - Complete curl commands
   - Request/response examples
   - Error handling scenarios

2. **Python/Frappe API Examples**
   - Using frappe.get_doc()
   - Using frappe.new_doc()
   - Proper error handling

3. **JavaScript/Client Side**
   - frappe.call() examples
   - Form script integration
   - Real-time updates

4. **Authentication Methods**
   - API key/secret authentication
   - Token-based authentication
   - Session-based access

5. **Common Patterns**
   - Bulk operations
   - Filtered queries
   - Related document handling
   - File attachments

6. **Best Practices**
   - Rate limiting considerations
   - Data validation
   - Transaction handling
   - Performance optimization

Please include realistic data examples and explain any DocType-specific considerations.`
        }
      }
    ]
  };
}

async function generateWorkflowDesignPrompt(businessProcess: string, modules?: string): Promise<GetPromptResult> {
  const availableModules = await getModuleList();
  const relevantModules = modules ? modules.split(',').map(m => m.trim()) : [];
  
  return {
    description: `Design a Frappe workflow for: ${businessProcess}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Help me design a comprehensive Frappe workflow for this business process:

**Business Process:** ${businessProcess}

${relevantModules.length > 0 ? `**Relevant Modules:** ${relevantModules.join(', ')}` : ''}

Please provide:

1. **Process Analysis**
   - Break down the business process into steps
   - Identify key stakeholders and roles
   - Map decision points and approvals

2. **DocType Selection**
   - Recommend appropriate DocTypes for each step
   - Suggest custom DocTypes if needed
   - Map relationships between DocTypes

3. **Workflow Design**
   - Define workflow states and transitions
   - Set up approval hierarchies
   - Configure notifications and alerts

4. **Automation Opportunities**
   - Identify steps that can be automated
   - Suggest server scripts and client scripts
   - Recommend integration points

5. **Implementation Plan**
   - Phase the implementation
   - Identify dependencies
   - Suggest testing approach

6. **User Training Considerations**
   - Key concepts users need to understand
   - Common pitfalls to avoid
   - Success metrics to track

Available modules in system: ${availableModules.slice(0, 15).join(', ')}

Please provide a detailed, actionable workflow design.`
        }
      }
    ]
  };
}

async function generateTroubleshootPrompt(issueDescription: string, module?: string): Promise<GetPromptResult> {
  return {
    description: `Troubleshoot Frappe issue: ${issueDescription}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Help me troubleshoot this Frappe issue:

**Issue Description:** ${issueDescription}
${module ? `**Module:** ${module}` : ''}

Please provide a systematic troubleshooting approach:

1. **Issue Classification**
   - Categorize the type of issue (performance, configuration, data, etc.)
   - Assess severity and impact
   - Identify affected components

2. **Diagnostic Steps**
   - Log files to check
   - Debug commands to run
   - Configuration settings to verify
   - Database queries to execute

3. **Common Causes**
   - List potential root causes
   - Explain how to verify each cause
   - Provide elimination strategies

4. **Resolution Steps**
   - Step-by-step fix procedures
   - Configuration changes needed
   - Code modifications if required
   - Testing procedures

5. **Prevention Measures**
   - How to prevent this issue in the future
   - Monitoring setup recommendations
   - Best practices to follow

6. **When to Escalate**
   - Situations requiring expert help
   - Information to gather before escalating
   - Community resources and documentation

Please provide specific, actionable troubleshooting guidance.`
        }
      }
    ]
  };
}

async function generatePerformancePrompt(performanceIssue: string, doctypeName?: string): Promise<GetPromptResult> {
  return {
    description: `Optimize Frappe performance for: ${performanceIssue}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Help me optimize Frappe performance for this issue:

**Performance Issue:** ${performanceIssue}
${doctypeName ? `**Affected DocType:** ${doctypeName}` : ''}

Please provide a comprehensive performance optimization strategy:

1. **Performance Analysis**
   - Identify bottlenecks and root causes
   - Analyze query performance
   - Review resource utilization

2. **Database Optimization**
   - Index optimization suggestions
   - Query optimization techniques
   - Database configuration tuning

3. **Application-Level Optimization**
   - Caching strategies
   - Lazy loading implementation
   - Background job optimization

4. **Frontend Performance**
   - Form loading optimization
   - Report rendering improvements
   - Client-side caching

5. **Server Configuration**
   - Web server tuning
   - Redis configuration
   - Process management

6. **Monitoring & Measurement**
   - Performance metrics to track
   - Monitoring tools setup
   - Benchmarking approaches

7. **Implementation Plan**
   - Prioritized optimization steps
   - Risk assessment for each change
   - Rollback strategies

Please provide specific, measurable optimization recommendations.`
        }
      }
    ]
  };
}

async function generateReportCreationPrompt(reportRequirements: string, reportType?: string): Promise<GetPromptResult> {
  const types = reportType ? [reportType] : ['query', 'script', 'print'];
  
  return {
    description: `Create custom Frappe report: ${reportRequirements}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Guide me through creating a custom Frappe report with these requirements:

**Report Requirements:** ${reportRequirements}
**Report Types to Consider:** ${types.join(', ')}

Please provide:

1. **Requirements Analysis**
   - Break down reporting requirements
   - Identify data sources and relationships
   - Define output format and layout

2. **Report Type Selection**
   - Compare query vs script vs print reports
   - Recommend best approach for requirements
   - Explain trade-offs and limitations

3. **Data Model Design**
   - Required DocTypes and fields
   - Join conditions and relationships
   - Filters and parameters needed

4. **Implementation Guide**
   - Step-by-step creation process
   - Code examples and templates
   - Testing procedures

5. **Optimization Techniques**
   - Query performance optimization
   - Caching strategies
   - Large dataset handling

6. **User Experience**
   - Filter interface design
   - Export options setup
   - Mobile responsiveness

7. **Deployment & Maintenance**
   - Version control considerations
   - Update procedures
   - Performance monitoring

Please provide detailed implementation guidance with code examples.`
        }
      }
    ]
  };
}

async function generateIntegrationPrompt(externalSystem: string, integrationType?: string): Promise<GetPromptResult> {
  const types = integrationType ? [integrationType] : ['webhook', 'api', 'file'];
  
  return {
    description: `Plan integration with ${externalSystem}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Help me plan integration between Frappe and ${externalSystem}:

**External System:** ${externalSystem}
**Integration Types to Consider:** ${types.join(', ')}

Please provide:

1. **Integration Strategy**
   - Analyze integration requirements
   - Choose optimal integration pattern
   - Define data flow direction

2. **Technical Approach**
   - API endpoints and authentication
   - Data mapping and transformation
   - Error handling and retry logic

3. **Implementation Plan**
   - Development phases and milestones
   - Testing strategy
   - Deployment approach

4. **Data Synchronization**
   - Real-time vs batch processing
   - Conflict resolution strategies
   - Data consistency guarantees

5. **Security Considerations**
   - Authentication mechanisms
   - Data encryption requirements
   - Access control setup

6. **Monitoring & Maintenance**
   - Integration health monitoring
   - Error logging and alerting
   - Performance tracking

7. **Fallback & Recovery**
   - Offline operation capabilities
   - Data recovery procedures
   - System failure handling

Please provide detailed technical guidance and best practices.`
        }
      }
    ]
  };
}

async function generateMigrationPrompt(sourceSystem: string, targetDoctypes?: string): Promise<GetPromptResult> {
  const modules = await getModuleList();
  
  return {
    description: `Plan data migration from ${sourceSystem} to Frappe`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Help me plan data migration from ${sourceSystem} to Frappe:

**Source System:** ${sourceSystem}
${targetDoctypes ? `**Target DocTypes:** ${targetDoctypes}` : ''}

Please provide:

1. **Migration Strategy**
   - Assess data complexity and volume
   - Choose migration approach (big bang vs phased)
   - Define success criteria

2. **Data Analysis**
   - Map source data to Frappe DocTypes
   - Identify data quality issues
   - Plan data transformation rules

3. **Technical Implementation**
   - Data extraction procedures
   - Transformation scripts and validation
   - Loading strategies and tools

4. **Pre-Migration Tasks**
   - Environment setup and testing
   - Backup and rollback procedures
   - User communication plan

5. **Migration Execution**
   - Step-by-step execution plan
   - Progress monitoring
   - Issue resolution procedures

6. **Post-Migration Activities**
   - Data validation and testing
   - User training and support
   - Performance optimization

7. **Risk Management**
   - Identify potential risks
   - Mitigation strategies
   - Contingency planning

Available DocTypes in target modules: ${modules.slice(0, 10).join(', ')}

Please provide a comprehensive migration plan with timelines.`
        }
      }
    ]
  };
}