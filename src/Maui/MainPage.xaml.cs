using JobSearchAssistant.Maui.Services;

namespace JobSearchAssistant.Maui;

public partial class MainPage : TabbedPage
{
    private readonly AppStateService _stateService = new();
    private bool _canPersistSelectedTab;
    public int SelectedTabIndex { get; private set; }

    public MainPage()
    {
        InitializeComponent();

        var theme = Application.Current?.RequestedTheme ?? AppTheme.Unspecified;
        var TabBackgroundColorKey = theme == AppTheme.Dark ? "TabbedBarBackgroundDarkColor" : "TabbedBarBackgroundColor";

        if (Application.Current?.Resources.TryGetValue(TabBackgroundColorKey, out var primaryColor) == true)
        {
            BarBackgroundColor = primaryColor is SolidColorBrush brush ? brush.Color : (Color)primaryColor;
        }

        var TabTextColorKey = theme == AppTheme.Dark ? "TabbedBarTextDarkColor" : "TabbedBarTextColor";

        if (Application.Current?.Resources.TryGetValue(TabTextColorKey, out var whiteColor) == true)
        {
            var color = whiteColor is SolidColorBrush brush ? brush.Color : (Color)whiteColor;
            BarTextColor = color;
            SelectedTabColor = color;
        }

        if (Application.Current?.Resources.TryGetValue("PrimaryDark", out var primaryDarkColor) == true)
        {
            UnselectedTabColor = primaryDarkColor is SolidColorBrush brush ? brush.Color : (Color)primaryDarkColor;
        }
    }

    protected override void OnCurrentPageChanged()
    {
        base.OnCurrentPageChanged();
        int selectedTabIndex = Children.IndexOf(CurrentPage);
        if (selectedTabIndex < 0)
        {
            return;
        }

        SelectedTabIndex = selectedTabIndex;
        if (_canPersistSelectedTab)
        {
            SaveSelectedTabIndex();
        }
    }

    public void RestoreSelectedTab(int selectedTabIndex)
    {
        if (Children.Count == 0)
        {
            return;
        }

        SelectedTabIndex = Math.Clamp(selectedTabIndex, 0, Children.Count - 1);
        CurrentPage = Children[SelectedTabIndex];
        _canPersistSelectedTab = true;
        SaveSelectedTabIndex();
    }

    private void SaveSelectedTabIndex()
    {
        var state = _stateService.LoadState();
        state.Navigation.SelectedTabIndex = SelectedTabIndex;
        _stateService.SaveState(state);
    }
}