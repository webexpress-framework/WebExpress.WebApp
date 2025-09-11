using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WebSettingPage
{
    /// <summary>
    /// Represents the general settings group for the web application.
    /// </summary>
    [WebIcon<IconGlobe>]
    [Name("webexpress.webapp:setting.group.general.name")]
    [Description("webexpress.webapp:setting.group.general.description")]
    [SettingSection(SettingSection.Primary)]
    [SettingCategory<SettingCategoryGeneral>]
    public sealed class SettingGroupGeneralGeneral : ISettingGroup
    {

    }
}
