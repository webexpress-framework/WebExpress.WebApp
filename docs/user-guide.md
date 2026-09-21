![WebExpress-Framework](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# User guide
Welcome to the `WebExpress.WebApp` User Guide. This guide will help you get started with `WebExpress.WebApp` and make the most out of its 
features. Follow the links below to begin your journey.

# Getting started
To get started with `WebExpress.WebApp`, use the following guides:

- [Installation Guide](https://github.com/webexpress-framework/WebExpress/blob/main/docs/installation_guide.md) 
- [Development Guide](https://github.com/webexpress-framework/WebExpress/blob/main/docs/development_guide.md)
- [WebExpress.WebCore API Documentation](https://webexpress-framework.github.io/WebExpress.WebCore/) 
- [WebExpress.WebUI API Documentation](https://webexpress-framework.github.io/WebExpress.WebUI/) 
- [WebExpress.WebApp API Documentation](https://webexpress-framework.github.io/WebExpress.WebApp/) 
- [WebExpress.WebIndex API Documentation](https://webexpress-framework.github.io/WebExpress.WebIndex/) 

# Certificate administration

For certificate diagnostics, open **Settings > System > Certificates**. The navigation entry remains visible alongside the other system settings, including during HTTP development without a signed-in identity. Access to the page requires the existing `WebExpress.WebCore.WebPolicies.SystemAccessPolicy`. The administrative scope alone does not grant access.

For the inventory overview, the page reads metadata exclusively through the host's `ICertificateManager`. Each entry shows its alias, configured hostnames, store, subject, issuer, thumbprint, validity period in UTC and status. Summary badges count configured, usable, soon-expiring and unusable entries. Loading failures and unsuitable certificates appear before healthy entries, and combined validation failures remain visible as separate status labels. Labels are available in English and German.

For operational changes, edit the existing server configuration and restart WebExpress. This first version provides an overview and diagnostics without uploading, exporting, deleting or changing certificates. Passwords, storage references and private key material are never included in the page. Reloading the page refreshes metadata and validity status without reloading files or replacing listener certificates. Local suitability checks do not establish client trust or check certificate revocation.

For environment separation, continue to use **HTTP for development** and configure **HTTPS only for production**. The empty state explains that HTTP development does not require certificates. An empty certificate inventory is expected during HTTP development. The [installation guide](https://github.com/webexpress-framework/WebExpress/blob/main/docs/installation_guide.md) describes production PFX deployment, aliases, hostname mappings and expiry warning thresholds.
