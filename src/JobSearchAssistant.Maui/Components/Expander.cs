namespace JobSearchAssistant.Maui.Components
{
    public static class Expander
    {
        public static readonly BindableProperty IsExpandedProperty =
            BindableProperty.CreateAttached(
                "IsExpanded",
                typeof(bool),
                typeof(Expander),
                false,
                propertyChanged: OnIsExpandedChanged);

        public static bool GetIsExpanded(BindableObject view) =>
            (bool)view.GetValue(IsExpandedProperty);

        public static void SetIsExpanded(BindableObject view, bool value) =>
            view.SetValue(IsExpandedProperty, value);

        public static void ToggleExpander(object? sender, EventArgs e)
        {
            if (sender is Element element)
            {
                var container = FindAncestor<Border>(element);
                if (container != null)
                {
                    bool newState = !Expander.GetIsExpanded(container);
                    Expander.SetIsExpanded(container, newState);
                }
            }
        }


        private static void OnIsExpandedChanged(BindableObject bindable, object oldValue, object newValue)
        {
            if (bindable is Border container)
            {
                ApplyExpandedState(container, (bool)newValue);
            }
        }

        public static void ApplyExpandedState(Border container)
        {
            ApplyExpandedState(container, GetIsExpanded(container));
        }

        private static void ApplyExpandedState(Border container, bool expanded)
        {
            // 1. Change padding automatically
            // container.Padding = expanded
            //     ? new Thickness(8, 4, 8, 8)
            //     : new Thickness(8, 4, 8, 4);

            // 2. Find toggle symbol automatically
            var toggle = FindByStyleClass<Label>(container, "ExpanderToggleSymbol");
            toggle?.Text = expanded ? "▼" : "▶";

            // 3. Find expander body automatically
            var body = FindByStyleClass<Layout>(container, "ExpanderBody");
            body?.IsVisible = expanded;
        }

        private static T? FindByStyleClass<T>(Element root, string styleClass) where T : Element
        {
            foreach (var child in GetAllChildren(root))
            {
                // Check if child is both T and VisualElement (which has StyleClass)
                if (child is T typed && child is VisualElement visualElement &&
                    visualElement.StyleClass != null &&
                    visualElement.StyleClass.Contains(styleClass))
                {
                    return typed;
                }
            }

            return null;
        }


        private static T? FindByStyleKey<T>(Element root, string styleKey) where T : Element
        {
            foreach (var child in GetAllChildren(root))
            {
                if (child is T typed && child is VisualElement visualElement &&
                    visualElement.Style?.Class == styleKey)
                { return typed; }
            }

            return null;
        }

        private static IEnumerable<Element> GetAllChildren(Element parent)
        {
            if (parent is IView view)
            {
                // Layouts (StackLayout, Grid, etc.)
                if (view is Layout layout)
                {
                    foreach (var child in layout.Children)
                    {
                        if (child is Element elementChild)
                        {
                            yield return elementChild;

                            foreach (var grandChild in GetAllChildren(elementChild))
                            { yield return grandChild; }
                        }
                    }
                }

                // Border (single child)
                if (view is Border border && border.Content is Element borderChild)
                {
                    yield return borderChild;

                    foreach (var grandChild in GetAllChildren(borderChild))
                    { yield return grandChild; }
                }

                // ContentView (single child)
                if (view is ContentView cv && cv.Content is Element cvChild)
                {
                    yield return cvChild;

                    foreach (var grandChild in GetAllChildren(cvChild))
                    { yield return grandChild; }
                }
            }
        }


        private static T? FindAncestor<T>(Element element) where T : Element
        {
            Element? parent = element.Parent;

            while (parent != null)
            {
                if (parent is T typed)
                { return typed; }

                parent = parent.Parent;
            }

            return null;
        }
    }
}
