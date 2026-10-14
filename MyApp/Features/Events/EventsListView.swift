import DesignSystem
import SwiftUI

/// News tab: owns the events store and the tab's navigation stack.
struct NewsTab: View {
    @Environment(AppContainer.self) private var container
    let router: Router

    var body: some View {
        NewsTabStack(store: EventsStore(repository: container.eventsRepository), router: router)
    }
}

/// Separate from `NewsTab` so the store is created once and owned with `@State`.
private struct NewsTabStack: View {
    @State var store: EventsStore
    @Bindable var router: Router

    var body: some View {
        NavigationStack(path: $router.path) {
            EventsListView()
                .withAppRoutes()
        }
        // On the stack, so pushed detail screens see live updates too.
        .environment(store)
        .environment(router)
    }
}

struct EventsListView: View {
    @Environment(EventsStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @State private var filter: VerificationStatus?
    @State private var showsGuide = false

    var body: some View {
        content
            .navigationTitle("News")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showsGuide = true
                    } label: {
                        Label("What the colors mean", systemImage: "info.circle")
                    }
                }
            }
            .sheet(isPresented: $showsGuide) {
                NavigationStack {
                    StatusGuideView()
                        .toolbar {
                            ToolbarItem(placement: .confirmationAction) {
                                Button("Done") { showsGuide = false }
                            }
                        }
                }
            }
            .task { await store.loadIfNeeded() }
            .task(id: scenePhase) {
                // Refresh every minute while the list is on screen and the app is active.
                guard scenePhase == .active else { return }
                await store.autoRefresh(every: .seconds(60))
            }
    }

    @ViewBuilder
    private var content: some View {
        switch store.phase {
        case .loading:
            LoadingView("Loading stories…")
        case .failed(let message):
            ErrorStateView(message: message) {
                Task { await store.refresh() }
            }
        case .empty:
            ContentUnavailableView {
                Label("No Stories Yet", systemImage: "newspaper")
            } description: {
                Text("Stories appear here as soon as a source reports them.")
            } actions: {
                Button("Refresh") { Task { await store.refresh() } }
            }
        case .loaded:
            EventsList(filter: $filter)
        }
    }
}

private struct EventsList: View {
    @Environment(EventsStore.self) private var store
    @Binding var filter: VerificationStatus?

    var body: some View {
        let sections = store.sections(filter: filter)
        List {
            if let error = store.lastError {
                RefreshErrorRow(message: error)
            }
            ForEach(sections) { section in
                Section {
                    ForEach(section.events) { event in
                        NavigationLink(value: AppRoute.eventDetail(event)) {
                            EventRow(event: event)
                        }
                        .accessibilityIdentifier("event.row.\(event.id)")
                    }
                } header: {
                    StatusSectionHeader(status: section.status.trust, count: section.events.count)
                }
            }
            if sections.isEmpty {
                NoMatchesRow(status: filter?.trust)
            }
            if let updated = store.lastUpdated {
                LastUpdatedRow(date: updated)
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            StatusFilterBar(selection: $filter)
        }
        .refreshable { await store.refresh() }
    }
}

private struct StatusSectionHeader: View {
    let status: TrustStatus
    let count: Int

    var body: some View {
        HStack(spacing: Spacing.xs) {
            StatusDot(status)
            Text(verbatim: status.label)
                .foregroundStyle(status.color)
            Text("\(count)")
                .font(.dsMono)
                .foregroundStyle(Color.dsTextSecondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

private struct RefreshErrorRow: View {
    let message: String

    var body: some View {
        Label {
            Text("Couldn't refresh. \(message)")
        } icon: {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.dsWarning)
        }
        .font(.dsCaption)
    }
}

private struct NoMatchesRow: View {
    let status: TrustStatus?

    var body: some View {
        if let status {
            Text("No stories are \(status.label.lowercased()) right now.")
                .foregroundStyle(Color.dsTextSecondary)
        } else {
            Text("No stories right now.")
                .foregroundStyle(Color.dsTextSecondary)
        }
    }
}

private struct LastUpdatedRow: View {
    let date: Date

    var body: some View {
        Text("Updated \(date, format: .relative(presentation: .named)). Refreshes every minute.")
            .font(.dsCaption)
            .foregroundStyle(Color.dsTextSecondary)
            .listRowBackground(Color.clear)
    }
}

#Preview("News") {
    NewsTab(router: Router())
        .environment(AppContainer.preview())
}

#Preview("News – dark, large text") {
    NewsTab(router: Router())
        .environment(AppContainer.preview())
        .preferredColorScheme(.dark)
        .dynamicTypeSize(.accessibility2)
}
