import DesignSystem
import SwiftUI

/// Every source the backend reads, with tier, owner, health and track record.
struct SourcesView: View {
    @Environment(AppContainer.self) private var container

    var body: some View {
        SourcesContentView(viewModel: SourcesViewModel(repository: container.sourcesRepository))
    }
}

/// Separate from `SourcesView` so the view model is created once and owned with `@State`.
private struct SourcesContentView: View {
    @State var viewModel: SourcesViewModel

    var body: some View {
        content
            .navigationTitle("Sources")
            .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading:
            LoadingView("Loading sources…")
        case .failed(let message):
            ErrorStateView(message: message) {
                Task { await viewModel.refresh() }
            }
        case .loaded(let sources) where sources.isEmpty:
            ContentUnavailableView("No Sources", systemImage: "antenna.radiowaves.left.and.right")
        case .loaded:
            SourcesList(viewModel: viewModel)
        }
    }
}

private struct SourcesList: View {
    @Bindable var viewModel: SourcesViewModel

    var body: some View {
        List {
            Section {
                SourcesIntro(unhealthyCount: viewModel.unhealthyCount)
            }
            ForEach(viewModel.sections) { section in
                Section {
                    ForEach(section.sources) { source in
                        SourceRow(source: source)
                    }
                } header: {
                    Text(verbatim: section.title)
                }
            }
        }
        .searchable(text: $viewModel.searchText, prompt: Text("Name, owner or country"))
        .refreshable { await viewModel.refresh() }
        .overlay {
            if viewModel.sections.isEmpty {
                ContentUnavailableView.search(text: viewModel.searchText)
            }
        }
    }
}

private struct SourcesIntro: View {
    let unhealthyCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("Only independent sources count. Feeds with the same owner count once, and social signals never confirm a story.")
                .font(.footnote)
                .foregroundStyle(Color.dsTextSecondary)
            if unhealthyCount > 0 {
                Label {
                    Text("^[\(unhealthyCount) source](inflect: true) not responding right now")
                } icon: {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Color.dsWarning)
                }
                .font(.footnote)
            }
        }
    }
}

private struct SourceRow: View {
    let source: NewsSourceInfo

    private var tierStyle: TagLabel.Style {
        switch source.tier {
        case "primary": .official
        case "signal": .chatter
        default: .neutral
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            AdaptiveStack {
                Text(source.name)
                    .font(.dsHeadline)
                TagLabel(verbatim: source.tierLabel, style: tierStyle)
                if source.stateFunded {
                    TagLabel("State-funded", style: .warning)
                }
            }
            Text("Owner: \(source.owner) · \(source.country)")
                .font(.dsCaption)
                .foregroundStyle(Color.dsTextSecondary)
            SourceHealth(source: source)
            if let record = source.trackRecord {
                TrackRecordLine(record: record)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

private struct SourceHealth: View {
    let source: NewsSourceInfo

    var body: some View {
        Label {
            if source.healthy, let last = source.lastSuccessAt {
                Text("Working · last read \(last, format: .relative(presentation: .named))")
            } else if source.healthy {
                Text("Working")
            } else {
                Text("Not responding")
            }
        } icon: {
            Image(systemName: source.healthy ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(source.healthy ? Color.dsStatusCorroborated : Color.dsWarning)
        }
        .font(.dsCaption)
    }
}

/// Early accuracy appears only once enough numbers were checked against the final official figure.
private struct TrackRecordLine: View {
    let record: NewsSourceInfo.TrackRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let accuracy = record.earlyAccuracyText() {
                Text("Early accuracy \(accuracy) · ^[\(record.numbersChecked) number](inflect: true) checked")
            } else {
                Text("Track record: ^[\(record.eventsSettled) event](inflect: true) settled, not enough numbers yet")
            }
            if record.disputedOrRetracted > 0 {
                Text("^[\(record.disputedOrRetracted) story](inflect: true) later disputed or retracted")
                    .foregroundStyle(Color.dsStatusDisputed)
            }
        }
        .font(.dsCaption)
        .foregroundStyle(Color.dsTextSecondary)
    }
}

#Preview("Sources") {
    NavigationStack {
        SourcesView()
    }
    .environment(AppContainer.preview())
}

#Preview("Sources – dark, large text") {
    NavigationStack {
        SourcesView()
    }
    .environment(AppContainer.preview())
    .preferredColorScheme(.dark)
    .dynamicTypeSize(.accessibility2)
}
