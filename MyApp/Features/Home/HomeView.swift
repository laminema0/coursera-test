import DesignSystem
import SwiftUI

struct HomeView: View {
    @Environment(AppContainer.self) private var container

    var body: some View {
        HomeContentView(viewModel: HomeViewModel(repository: container.homeRepository))
    }
}

/// Separate from `HomeView` so the view model is created once and owned with `@State`.
private struct HomeContentView: View {
    @State var viewModel: HomeViewModel
    @Environment(Router.self) private var router

    var body: some View {
        content
            .navigationTitle("Home")
            .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading:
            LoadingView()
        case .failed(let message):
            ErrorStateView(message: message) {
                Task { await viewModel.refresh() }
            }
        case .loaded(let items) where items.isEmpty:
            ContentUnavailableView("No Items Yet", systemImage: "tray")
        case .loaded(let items):
            List(items) { item in
                Button {
                    router.push(.itemDetail(item))
                } label: {
                    VStack(alignment: .leading, spacing: Spacing.xxs) {
                        Text(item.title).font(.dsHeadline)
                        Text(item.subtitle)
                            .font(.dsCaption)
                            .foregroundStyle(Color.dsTextSecondary)
                    }
                }
                .tint(.primary)
            }
            .refreshable { await viewModel.refresh() }
        }
    }
}

struct ItemDetailView: View {
    let item: Item

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text(item.title).font(.dsLargeTitle)
            Text(item.subtitle).font(.dsBody)
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.lg)
        .navigationTitle(item.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        HomeView().withAppRoutes()
    }
    .environment(AppContainer.preview())
    .environment(Router())
}
