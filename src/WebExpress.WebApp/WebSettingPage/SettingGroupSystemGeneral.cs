using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WebSettingPage
{
    /// <summary>
    /// Represents the system settings group for the web application.
    /// </summary>
    [WebIcon<IconGlobe>]
    [Name("webexpress.webapp:setting.group.system.name")]
    [Description("webexpress.webapp:setting.group.general.description")]
    [SettingSection(SettingSection.Primary)]
    [SettingCategory<SettingCategorySystem>]
    public sealed class SettingGroupSystemGeneral : ISettingGroup
    {

    }
}
