# =============================================================================
# Cabinex AI — CAD Constraint-Aware Architectural Layout & Geometric Solver
# (c) 2026 Cabinex AI. All Rights Reserved.
# =============================================================================

begin
  require 'sketchup.rb'
rescue LoadError
  # Standalone testing runtime environment shim
  unless Numeric.method_defined?(:mm)
    class Numeric
      def mm; self.to_f; end
      def inch; self.to_f * 25.4; end
      def to_mm; self.to_f; end
    end
  end
end

require 'json'

module CabinexAI
  module LayoutSolver
    # -------------------------------------------------------------------------
    # 1. HARD ARCHITECTURAL & HARDWARE CONSTANTS
    # -------------------------------------------------------------------------
    BASE_DEPTH                = 600.mm
    TOP_DEPTH                 = 350.mm
    BASE_BLIND_RETURN         = 625.mm
    TOP_BLIND_RETURN          = 375.mm
    MIN_CORNER_ACCESS_DOOR    = 450.mm
    MIN_BASE_CORNER_WIDTH     = 1075.mm   # 625mm return + 450mm min usable front
    MIN_TOP_CORNER_WIDTH      = 825.mm    # 375mm return + 450mm min usable front
    PREFERRED_SINGLE_DOOR_MAX = 600.mm   # Standard: 600mm gets 1 clean door
    MAX_DOUBLE_DOOR_SPAN      = 1200.mm  # >600mm and <=1200mm gets 2 balanced leaves
    STANDARD_BASE_WIDTHS      = [600, 500, 450, 400]
    STANDARD_TOP_WIDTHS       = [600, 500, 450, 400]

    # -------------------------------------------------------------------------
    # 2. IMMUTABLE ARCHITECTURAL OPENINGS & KEEP-OUT CONSTRAINT ENGINE
    # -------------------------------------------------------------------------
    class OpeningConstraint
      def self.extract_openings(openings_input)
        return [] if openings_input.nil?
        list = []
        if openings_input.is_a?(Array)
          list = openings_input
        elsif openings_input.is_a?(Hash)
          list = openings_input['__list__'] || []
          if list.empty?
            if openings_input['window_wall'] && openings_input['window_wall'] != 'none'
              list << {
                'type' => 'window',
                'wall' => openings_input['window_wall'],
                'offset' => (openings_input['window_offset_mm'] || 1200).to_f,
                'width' => (openings_input['window_width_mm'] || 1200).to_f,
                'height' => (openings_input['window_sill_mm'] || 1050).to_f
              }
            end
            if openings_input['door_wall'] && openings_input['door_wall'] != 'none'
              list << {
                'type' => 'door',
                'wall' => openings_input['door_wall'],
                'offset' => (openings_input['door_offset_mm'] || 2400).to_f,
                'width' => (openings_input['door_width_mm'] || 900).to_f,
                'height' => 2100.0
              }
            end
          end
        end
        list
      end

      # Derives legal buildable spans along a wall by strictly subtracting keep-outs
      def self.legal_spans_for(wall_id, wall_length, layer, openings_list, min_span_w = 200.mm)
        wall_len_val = wall_length.to_f
        current_spans = [[0.0, wall_len_val]]
        openings = extract_openings(openings_list)

        openings.each do |op|
          next unless op['wall'].to_s.upcase == wall_id.to_s.upcase
          op_type = (op['type'] || 'window').to_s.downcase
          s0 = (op['offset'] || op['offset_mm'] || 0).to_f
          w  = (op['width']  || op['width_mm']  || 900).to_f
          s1 = s0 + w
          sill = (op['height'] || op['sill_mm'] || (op_type == 'window' ? 1050 : 0)).to_f

          blocks_layer = false
          case layer
          when :base
            blocks_layer = (op_type == 'door') || (op_type == 'obstacle') || (op_type == 'window' && sill < 870.0)
          when :top, :overhead
            blocks_layer = true
          when :tall
            blocks_layer = true
          end

          next unless blocks_layer

          new_spans = []
          current_spans.each do |span|
            span_start, span_end = span[0], span[1]

            if s1 <= span_start || s0 >= span_end
              new_spans << span
            else
              if s0 > span_start + 10.0
                new_spans << [span_start, s0]
              end
              if s1 < span_end - 10.0
                new_spans << [s1, span_end]
              end
            end
          end
          current_spans = new_spans
        end

        current_spans.select { |span| (span[1] - span[0]) >= min_span_w.to_f }
      end
    end

    # -------------------------------------------------------------------------
    # 3. CORNER CANDIDATE SCORING & RESOLUTION ENGINE
    # -------------------------------------------------------------------------
    class CornerSolver
      def self.score_and_solve_l_corner(wall_a_len, wall_b_len, openings_list)
        wall_a = wall_a_len.to_f
        wall_b = wall_b_len.to_f

        base_spans_a = OpeningConstraint.legal_spans_for('A', wall_a, :base, openings_list)
        base_spans_b = OpeningConstraint.legal_spans_for('B', wall_b, :base, openings_list)

        candidates = []

        span_a_corner = base_spans_a.find { |s| s[1] >= (wall_a - 10.0) }
        span_b_corner = base_spans_b.find { |s| s[0] <= 10.0 }

        if span_a_corner && span_b_corner
          avail_corner_a = span_a_corner[1] - span_a_corner[0]
          avail_approach_b = span_b_corner[1] - span_b_corner[0]

          if avail_corner_a >= 1075.0 && avail_approach_b >= 625.0
            corner_w_a = [1075.0, avail_corner_a].min
            access_front_a = corner_w_a - 625.0
            if access_front_a >= 450.0
              rem_a = avail_corner_a - corner_w_a
              rem_b = avail_approach_b - 625.0
              score_a = 100.0 + (access_front_a - 450.0) * 0.1
              score_a += (rem_a % 150 == 0 ? 20.0 : 0.0)
              score_a += (rem_b % 150 == 0 ? 20.0 : 0.0)

              candidates << {
                owner: 'A',
                corner_w: corner_w_a,
                return_offset: 625.0,
                access_front: access_front_a,
                score: score_a
              }
            end
          end
        end

        span_b_start = base_spans_b.find { |s| s[0] <= 10.0 }
        span_a_end   = base_spans_a.find { |s| s[1] >= (wall_a - 10.0) }

        if span_b_start && span_a_end
          avail_corner_b = span_b_start[1] - span_b_start[0]
          avail_approach_a = span_a_end[1] - span_a_end[0]

          if avail_corner_b >= 1075.0 && avail_approach_a >= 625.0
            corner_w_b = [1075.0, avail_corner_b].min
            access_front_b = corner_w_b - 625.0
            if access_front_b >= 450.0
              rem_b = avail_corner_b - corner_w_b
              rem_a = avail_approach_a - 625.0
              score_b = 95.0 + (access_front_b - 450.0) * 0.1
              score_b += (rem_b % 150 == 0 ? 20.0 : 0.0)
              score_b += (rem_a % 150 == 0 ? 20.0 : 0.0)

              candidates << {
                owner: 'B',
                corner_w: corner_w_b,
                return_offset: 625.0,
                access_front: access_front_b,
                score: score_b
              }
            end
          end
        end

        if candidates.empty?
          return {
            valid: true,
            owner: 'A',
            corner_w: 1075.0,
            return_offset: 625.0,
            access_front: 450.0,
            score: 50.0
          }
        end

        best = candidates.max_by { |c| c[:score] }
        best[:valid] = true
        best
      end
    end

    # -------------------------------------------------------------------------
    # 4. STANDARD-WIDTH MODULE OPTIMIZER
    # -------------------------------------------------------------------------
    class ModuleOptimizer
      def self.find_best_modular_combination(span_width_mm, allowed_sizes = STANDARD_BASE_WIDTHS)
        target = span_width_mm.to_f.round
        return [] if target < 200

        target_bay_w = 600.0
        bay_count = [1, (target / target_bay_w).round].max
        per_bay = (target / bay_count.to_f).round(1)

        if per_bay >= 400.0 && per_bay <= 650.0
          return Array.new(bay_count, per_bay)
        end

        units = []
        rem = target
        while rem >= 550.0
          units << 600.0
          rem -= 600.0
        end

        if rem >= 400.0
          units << rem.round(1)
        elsif rem > 0 && units.any?
          units[-1] = (units[-1] + rem).round(1)
        elsif rem > 0
          units << rem.round(1)
        end

        units
      end

      def self.solve_span_into_modules(span_start_mm, span_end_mm, wall_id, role = :base, requested_appliances = {})
        s0 = span_start_mm.to_f
        s1 = span_end_mm.to_f
        span_w = (s1 - s0).round(1)
        return [] if span_w < 150.0

        widths = find_best_modular_combination(span_w)
        modules = []
        cur_x = s0

        widths.each_with_index do |w, idx|
          x_start = cur_x
          x_end   = (cur_x + w).round(1)
          cur_x   = x_end

          if role == :base
            if idx == 0 && requested_appliances[:has_drawers] != false
              modules << {
                'type' => 'drawers', 'width' => w, 'drawer_count' => 3, 'infill' => 'acp',
                'overhead' => 'yes', 'handle' => 'top', 'wall' => wall_id,
                'x0_mm' => x_start, 'x1_mm' => x_end, 'span_id' => "#{wall_id}_BASE_#{s0.round}"
              }
            elsif idx == 1 && requested_appliances[:has_cooker] == true
              modules << {
                'type' => 'cooker', 'width' => w, 'infill' => 'acp',
                'overhead' => 'hood', 'handle' => 'top', 'wall' => wall_id,
                'x0_mm' => x_start, 'x1_mm' => x_end, 'span_id' => "#{wall_id}_BASE_#{s0.round}"
              }
            elsif requested_appliances[:has_sink] == true && (idx == 1 || (idx == 0 && widths.length == 1))
              modules << {
                'type' => 'sink', 'width' => w, 'infill' => 'glass',
                'overhead' => 'yes', 'handle' => 'top', 'wall' => wall_id,
                'x0_mm' => x_start, 'x1_mm' => x_end, 'span_id' => "#{wall_id}_BASE_#{s0.round}"
              }
            else
              modules << {
                'type' => 'door', 'width' => w, 'infill' => 'glass',
                'overhead' => 'yes', 'handle' => 'top', 'wall' => wall_id,
                'x0_mm' => x_start, 'x1_mm' => x_end, 'span_id' => "#{wall_id}_BASE_#{s0.round}"
              }
            end
          else
            modules << {
              'width' => w, 'is_hood' => false, 'is_open' => false, 'wall' => wall_id,
              'x0_mm' => x_start, 'x1_mm' => x_end, 'span_id' => "#{wall_id}_TOP_#{s0.round}"
            }
          end
        end

        modules
      end
    end

    # -------------------------------------------------------------------------
    # 5. USER CUSTOM MODULE NORMALIZER & INTELLIGENT AUTO-FIT/FILL MAPPER
    # -------------------------------------------------------------------------
    class CustomModuleMapper
      def self.map_custom_modules_to_spans(custom_list, wall_id, legal_base_spans, corner_solution = nil, wall_length_mm = 2488.0)
        return [] if custom_list.nil? || custom_list.empty?

        wall_len = wall_length_mm.to_f
        mapped_modules = []

        effective_spans = []
        legal_base_spans.each do |span|
          s0 = span[0]
          s1 = span[1]

          if corner_solution && corner_solution[:valid]
            if corner_solution[:owner] == 'A' && wall_id == 'B'
              s0 = [s0, 625.0].max
            elsif corner_solution[:owner] == 'B' && wall_id == 'A'
              s1 = [s1, wall_len - 625.0].min
            elsif corner_solution[:owner] == 'A' && wall_id == 'A'
              s1 = [s1, wall_len - 1075.0].min
            end
          end

          effective_spans << [s0, s1] if s1 > s0 + 100.0
        end

        return [] if effective_spans.empty?

        blind_mod = custom_list.find { |m| (m['type'] || '').to_s == 'blind_corner' }
        non_blind_mods = custom_list.reject { |m| (m['type'] || '').to_s == 'blind_corner' }

        total_avail_span = effective_spans.sum { |s| s[1] - s[0] }
        requested_span_sum = non_blind_mods.sum { |m| (m['width'] || 600).to_f }

        fitted_mods = non_blind_mods.map(&:dup)

        if requested_span_sum > (total_avail_span + 10.0)
          while fitted_mods.sum { |m| (m['width'] || 600).to_f } > (total_avail_span + 10.0) && fitted_mods.any? { |m| m['type'] == 'door' }
            door_idx = fitted_mods.rindex { |m| m['type'] == 'door' }
            break unless door_idx
            fitted_mods.delete_at(door_idx)
          end

          # -------------------------------------------------------------
          # ASSIGN, DIVIDE, BALANCE DOORS: Grid-perfect allocation
          # -------------------------------------------------------------
          fixed_types = %w[cooker sink tall_oven filler]
          fixed_mods = fitted_mods.select { |m| fixed_types.include?(m['type']) }
          flex_mods = fitted_mods.reject { |m| fixed_types.include?(m['type']) }

          fixed_mods.each { |m| m['width'] = [(m['width'] || 600).to_f, 600.0].min }
          fixed_sum = fixed_mods.sum { |m| m['width'] }
          
          flex_rem = total_avail_span - fixed_sum
          if flex_mods.any? && flex_rem > 0
            # Perfect mathematical division of remaining space
            base_w = flex_rem / flex_mods.length
            flex_mods.each_with_index do |m, idx|
              w = base_w.round(1)
              # Handle trailing float precision on the last module
              if idx == flex_mods.length - 1
                w = (flex_rem - flex_mods[0...idx].sum { |fm| fm['width'] }).round(1)
              end
              m['width'] = w
            end
          end
        end

        cur_span_idx = 0
        current_span = effective_spans[cur_span_idx]
        cur_x = current_span[0]

        fitted_mods.each do |mod|
          m = mod.dup
          bw = (m['width'] || 600).to_f

          rem_in_span = current_span[1] - cur_x
          if bw > rem_in_span + 10.0
            if cur_span_idx + 1 < effective_spans.length
              cur_span_idx += 1
              current_span = effective_spans[cur_span_idx]
              cur_x = current_span[0]
            else
              bw = [rem_in_span, (m['type'] == 'filler' ? 20.0 : 400.0)].min
            end
          end

          x0 = cur_x
          x1 = (cur_x + bw).round(1)
          cur_x = x1

          m['wall'] = wall_id
          m['width'] = bw.round(1)
          m['x0_mm'] = x0
          m['x1_mm'] = x1
          m['span_id'] = "#{wall_id}_BASE_#{current_span[0].round}"

          # Strictly normalize overhead property by module type (never leave stale indices)
          if m['type'] == 'cooker'
            m['overhead'] = 'hood'
          elsif m['type'] == 'sink'
            m['overhead'] = (m['overhead'] == 'hood' ? 'yes' : (m['overhead'] || 'yes'))
          elsif m['type'] == 'tall_oven' || m['type'] == 'tall_pantry' || m['type'] == 'filler'
            m['overhead'] = 'none'
          end

          mapped_modules << m
        end

        if blind_mod
          bm = blind_mod.dup
          corner_w = [(bm['width'] || 1075).to_f, MIN_BASE_CORNER_WIDTH.to_f].max
          bm['width'] = corner_w.round(1)
          bm['wall'] = wall_id

          if wall_id == 'A'
            bm['x0_mm'] = (wall_len - corner_w).round(1)
            bm['x1_mm'] = wall_len.round(1)
            bm['span_id'] = "A_BASE_CORNER"
          elsif wall_id == 'B'
            bm['x0_mm'] = 0.0
            bm['x1_mm'] = corner_w.round(1)
            bm['span_id'] = "B_BASE_CORNER"
          end

          mapped_modules << bm
        end

        mapped_modules.sort_by { |m| m['x0_mm'] }
      end
    end

    # -------------------------------------------------------------------------
    # 6. PURE GEOMETRIC COLLISION VALIDATOR
    # -------------------------------------------------------------------------
    class LayoutValidator
      def self.validate_layout(layout_result)
        violations = []
        openings = layout_result[:openings] || []
        corner = layout_result[:corner]

        if corner && corner[:valid]
          if corner[:owner] == 'A'
            ((layout_result[:walls] || {})['B'] || {})[:base_runs]&.each do |run|
              run[:modules]&.each do |m|
                if m['x0_mm'].to_f < 624.5 && m['type'] != 'blind_corner'
                  violations << "Wall B #{m['type'].upcase} [#{m['x0_mm']}..#{m['x1_mm']}mm] overlaps corner approach keep-out [0..625mm] owned by Wall A."
                end
              end
            end
          elsif corner[:owner] == 'B'
            wall_a_len = layout_result[:room]['wall_a_mm'].to_f
            ((layout_result[:walls] || {})['A'] || {})[:base_runs]&.each do |run|
              run[:modules]&.each do |m|
                if m['x1_mm'].to_f > (wall_a_len - 624.5) && m['type'] != 'blind_corner'
                  violations << "Wall A #{m['type'].upcase} [#{m['x0_mm']}..#{m['x1_mm']}mm] overlaps corner approach keep-out [#{wall_a_len - 625}..#{wall_a_len}mm] owned by Wall B."
                end
              end
            end
          end
        end

        (layout_result[:walls] || {}).each do |wall_id, wall_data|
          (wall_data[:base_runs] || []).each do |run|
            (run[:modules] || []).each do |m|
              mx0 = m['x0_mm'].to_f
              mx1 = m['x1_mm'].to_f

              openings.each do |op|
                next unless op['wall'].to_s.upcase == wall_id.to_s.upcase
                op_type = (op['type'] || 'window').to_s.downcase
                ox0 = (op['offset'] || op['offset_mm'] || 0).to_f
                ox1 = ox0 + (op['width'] || op['width_mm'] || 900).to_f
                sill = (op['height'] || op['sill_mm'] || (op_type == 'window' ? 1050 : 0)).to_f

                if op_type == 'door' || op_type == 'obstacle' || (op_type == 'window' && sill < 870.0)
                  if !(mx1 <= ox0 + 0.5 || mx0 >= ox1 - 0.5)
                    violations << "Base Module '#{m['type']}' [#{mx0}..#{mx1}mm] overlaps #{op_type.upcase} [#{ox0}..#{ox1}mm] on Wall #{wall_id}."
                  end
                end

                if (m['type'] == 'cooker' || m['overhead'] == 'hood')
                  if !(mx1 <= ox0 + 0.5 || mx0 >= ox1 - 0.5)
                    violations << "Cooker & Range Hood [#{mx0}..#{mx1}mm] overlaps #{op_type.upcase} [#{ox0}..#{ox1}mm] on Wall #{wall_id}."
                  end
                end

                if (m['type'] == 'tall_oven' || m['type'] == 'tall_pantry')
                  if !(mx1 <= ox0 + 0.5 || mx0 >= ox1 - 0.5)
                    violations << "Tall Unit [#{mx0}..#{mx1}mm] overlaps #{op_type.upcase} [#{ox0}..#{ox1}mm] on Wall #{wall_id}."
                  end
                end
              end
            end
          end

          (wall_data[:top_runs] || []).each do |run|
            (run[:bays] || []).each do |tb|
              tx0 = tb['x0_mm'] || tb[:x] || 0.0
              tx1 = tx0 + (tb['width'] || tb[:width] || 600.0)

              openings.each do |op|
                next unless op['wall'].to_s.upcase == wall_id.to_s.upcase
                ox0 = (op['offset'] || op['offset_mm'] || 0).to_f
                ox1 = ox0 + (op['width'] || op['width_mm'] || 900).to_f

                if !(tx1 <= ox0 + 0.5 || tx0 >= ox1 - 0.5)
                  violations << "Overhead Bay [#{tx0}..#{tx1}mm] overlaps #{op['type'].upcase} [#{ox0}..#{ox1}mm] on Wall #{wall_id}."
                end
              end
            end
          end
        end

        violations
      end
    end

    # -------------------------------------------------------------------------
    # 7. MULTI-CANDIDATE ARCHITECTURAL REPAIR ENGINE (BOUNDED SEARCH)
    # -------------------------------------------------------------------------
    class ArchitecturalRepairEngine
      # Searches valid candidate architectural arrangements across all walls
      def self.search_and_repair_candidates(custom_modules, openings_list, room_specs, style)
        return nil if custom_modules.nil?

        openings = OpeningConstraint.extract_openings(openings_list)
        wall_a_len = (room_specs['wall_a_mm'] || 2488).to_f
        wall_b_len = (room_specs['wall_b_mm'] || 2379).to_f

        candidates = []

        # Candidate A: Sink under window + Cooker on clear Wall A span
        c_a = deep_clone(custom_modules)
        if c_a['A']
          cooker_idx = c_a['A'].find_index { |m| m['type'] == 'cooker' }
          sink_idx   = c_a['A'].find_index { |m| m['type'] == 'sink' }
          if cooker_idx && sink_idx
            c_a['A'][cooker_idx], c_a['A'][sink_idx] = c_a['A'][sink_idx], c_a['A'][cooker_idx]
          end
          normalize_appliance_types!(c_a)
          candidates << c_a
        end

        # Candidate B: Sink under window on Wall A + Cooker relocated to Wall B
        c_b = deep_clone(custom_modules)
        if c_b['A'] && c_b['B']
          cooker_idx = c_b['A'].find_index { |m| m['type'] == 'cooker' }
          if cooker_idx
            c_b['A'][cooker_idx]['type'] = 'sink'
            b_target = c_b['B'].find { |m| m['type'] == 'door' || m['type'] == 'drawers' }
            if b_target
              b_target['type'] = 'cooker'
            else
              c_b['B'].unshift({ 'type' => 'cooker', 'width' => 600, 'overhead' => 'hood' })
            end
          end
          normalize_appliance_types!(c_b)
          candidates << c_b
        end

        # Candidate C: Move cooker to first clear solid span on Wall A
        c_c = deep_clone(custom_modules)
        if c_c['A']
          cooker_idx = c_c['A'].find_index { |m| m['type'] == 'cooker' }
          if cooker_idx && cooker_idx > 0
            cooker = c_c['A'].delete_at(cooker_idx)
            c_c['A'].unshift(cooker)
          end
          normalize_appliance_types!(c_c)
          candidates << c_c
        end

        # Candidate D: Rearrange standard modules (Drawers first, Cooker second)
        c_d = deep_clone(custom_modules)
        if c_d['A']
          non_blind = c_d['A'].reject { |m| m['type'] == 'blind_corner' }
          blind     = c_d['A'].find { |m| m['type'] == 'blind_corner' }
          rearranged = non_blind.sort_by { |m| (m['type'] == 'drawers' ? 0 : (m['type'] == 'cooker' ? 1 : 2)) }
          rearranged << blind if blind
          c_d['A'] = rearranged
          normalize_appliance_types!(c_d)
          candidates << c_d
        end

        # Candidate E: Relocate tall unit to end of Wall B
        c_e = deep_clone(custom_modules)
        if c_e['B'] && c_e['B'].any? { |m| m['type'] == 'tall_oven' }
          tall_idx = c_e['B'].find_index { |m| m['type'] == 'tall_oven' }
          tall = c_e['B'].delete_at(tall_idx)
          c_e['B'].push(tall)
          normalize_appliance_types!(c_e)
          candidates << c_e
        end

        # Evaluate each candidate through the raw solver and pick the best passing candidate
        candidates.each do |candidate|
          res = LayoutSolver.solve_kitchen_layout_raw(room_specs, openings_list, style, candidate)
          if res[:success]
            res[:repaired] = true
            return res
          end
        end

        nil
      end

      def self.deep_clone(obj)
        Marshal.load(Marshal.dump(obj))
      end

      def self.normalize_appliance_types!(custom_mods)
        (custom_mods || {}).each do |wall_id, mods|
          (mods || []).each do |m|
            case m['type'].to_s
            when 'cooker'
              m['overhead'] = 'hood'
            when 'sink'
              m['overhead'] = 'yes' if m['overhead'] == 'hood'
            end
          end
        end
      end
    end

    # -------------------------------------------------------------------------
    # 8. MASTER SOLVER PIPELINE (WITH EXHAUSTIVE BOUNDED SEARCH)
    # -------------------------------------------------------------------------
    def self.solve_kitchen_layout(room_specs, openings_list, style = {}, custom_modules = nil)
      raw_result = solve_kitchen_layout_raw(room_specs, openings_list, style, custom_modules)
      return raw_result if raw_result[:success]

      # Invoke Multi-Candidate Architectural Repair Engine
      if custom_modules && raw_result[:violations].any?
        repaired_result = ArchitecturalRepairEngine.search_and_repair_candidates(custom_modules, openings_list, room_specs, style)
        return repaired_result if repaired_result && repaired_result[:success]

        # Exhaustive search fallback: pure automatic design
        fallback_result = solve_kitchen_layout_raw(room_specs, openings_list, style, nil)
        if fallback_result[:success]
          fallback_result[:repaired] = true
          return fallback_result
        end
      end

      raw_result
    end

    def self.solve_kitchen_layout_raw(room_specs, openings_list, style = {}, custom_modules = nil)
      wall_a_len = (room_specs['wall_a_mm'] || 2488).to_f
      wall_b_len = (room_specs['wall_b_mm'] || 2379).to_f
      wall_c_len = (room_specs['wall_c_mm'] || 0).to_f
      isl_len    = (room_specs['island_length_mm'] || 0).to_f
      layout_type = (room_specs['layout_type'] || 'L_SHAPE').to_s.upcase

      openings = OpeningConstraint.extract_openings(openings_list)

      base_spans_a = OpeningConstraint.legal_spans_for('A', wall_a_len, :base, openings)
      top_spans_a  = OpeningConstraint.legal_spans_for('A', wall_a_len, :top,  openings)

      base_spans_b = (wall_b_len > 0 && layout_type != 'LINEAR') ? OpeningConstraint.legal_spans_for('B', wall_b_len, :base, openings) : []
      top_spans_b  = (wall_b_len > 0 && layout_type != 'LINEAR') ? OpeningConstraint.legal_spans_for('B', wall_b_len, :top,  openings) : []

      base_spans_c = (wall_c_len > 0 && layout_type.include?('U_')) ? OpeningConstraint.legal_spans_for('C', wall_c_len, :base, openings) : []
      top_spans_c  = (wall_c_len > 0 && layout_type.include?('U_')) ? OpeningConstraint.legal_spans_for('C', wall_c_len, :top,  openings) : []

      corner_solution = nil
      if wall_b_len > 0 && layout_type != 'LINEAR'
        corner_solution = CornerSolver.score_and_solve_l_corner(wall_a_len, wall_b_len, openings)
      end

      wall_a_base_runs = []
      user_a = custom_modules && custom_modules['A'] && custom_modules['A'].any? ? custom_modules['A'] : nil

      if user_a
        mapped_a = CustomModuleMapper.map_custom_modules_to_spans(user_a, 'A', base_spans_a, corner_solution, wall_a_len)
        wall_a_base_runs << { start_mm: mapped_a.first['x0_mm'], end_mm: mapped_a.last['x1_mm'], modules: mapped_a } if mapped_a.any?
      else
        base_spans_a.each do |span|
          s0, s1 = span[0], span[1]
          span_len = s1 - s0
          is_corner_span = (corner_solution && corner_solution[:owner] == 'A' && (s1 - wall_a_len).abs < 5.0)

          span_has_win = openings.any? { |op| op['wall'].to_s.upcase == 'A' && op['type'] == 'window' && !(s1 <= op['offset'].to_f || s0 >= op['offset'].to_f + op['width'].to_f) }

          run_mods = []
          if is_corner_span
            corner_w = [corner_solution[:corner_w], span_len].min
            main_span = span_len - corner_w
            if main_span >= 200.0
              run_mods.concat(ModuleOptimizer.solve_span_into_modules(s0, s0 + main_span, 'A', :base, { has_drawers: true, has_cooker: !span_has_win, has_sink: span_has_win }))
            end
            run_mods << {
              'type' => 'blind_corner', 'width' => corner_w, 'infill' => 'acp', 'overhead' => 'yes', 'handle' => 'top',
              'wall' => 'A', 'x0_mm' => s0 + main_span, 'x1_mm' => s1, 'span_id' => "A_BASE_CORNER"
            }
          else
            run_mods.concat(ModuleOptimizer.solve_span_into_modules(s0, s1, 'A', :base, { has_drawers: true, has_cooker: !span_has_win, has_sink: span_has_win }))
          end

          wall_a_base_runs << { start_mm: s0, end_mm: s1, modules: run_mods } if run_mods.any?
        end
      end

      wall_a_top_runs = []
      top_spans_a.each do |span|
        s0, s1 = span[0], span[1]
        top_bays = ModuleOptimizer.solve_span_into_modules(s0, s1, 'A', :top)
        wall_a_top_runs << { start_mm: s0, end_mm: s1, bays: top_bays } if top_bays.any?
      end

      wall_b_base_runs = []
      wall_b_top_runs  = []
      user_b = custom_modules && custom_modules['B'] && custom_modules['B'].any? ? custom_modules['B'] : nil

      if wall_b_len > 0 && layout_type != 'LINEAR'
        if user_b
          mapped_b = CustomModuleMapper.map_custom_modules_to_spans(user_b, 'B', base_spans_b, corner_solution, wall_b_len)
          wall_b_base_runs << { start_mm: mapped_b.first['x0_mm'], end_mm: mapped_b.last['x1_mm'], modules: mapped_b } if mapped_b.any?
        else
          base_spans_b.each do |span|
            s0 = [span[0], (corner_solution && corner_solution[:owner] == 'A' ? BASE_BLIND_RETURN.to_f : 0.0)].max
            s1 = span[1]
            avail_span = s1 - s0
            next if avail_span < 200.0

            span_has_win = openings.any? { |op| op['wall'].to_s.upcase == 'B' && op['type'] == 'window' && !(s1 <= op['offset'].to_f || s0 >= op['offset'].to_f + op['width'].to_f) }
            has_tall = (avail_span >= 1275.0 && !span_has_win)
            tall_w = has_tall ? 600.0 : 0.0
            filler_w = has_tall ? 75.0 : 0.0
            base_w = avail_span - tall_w - filler_w

            run_mods = []
            if base_w >= 200.0
              a_has_cooker = wall_a_base_runs.flat_map { |r| r[:modules] }.any? { |m| m['type'] == 'cooker' }
              run_mods.concat(ModuleOptimizer.solve_span_into_modules(s0, s0 + base_w, 'B', :base, { has_sink: a_has_cooker, has_cooker: !a_has_cooker }))
            end
            if has_tall
              run_mods << {
                'type' => 'tall_oven', 'width' => tall_w, 'infill' => 'glass', 'overhead' => 'none', 'handle' => 'side',
                'wall' => 'B', 'x0_mm' => s0 + base_w, 'x1_mm' => s0 + base_w + tall_w, 'span_id' => "B_BASE_TALL"
              }
              run_mods << {
                'type' => 'filler', 'width' => filler_w, 'infill' => 'acp', 'overhead' => 'none', 'handle' => 'none',
                'wall' => 'B', 'x0_mm' => s0 + base_w + tall_w, 'x1_mm' => s1, 'span_id' => "B_BASE_FILLER"
              }
            end

            wall_b_base_runs << { start_mm: s0, end_mm: s1, modules: run_mods } if run_mods.any?
          end
        end

        top_spans_b.each do |span|
          s0 = [span[0], (corner_solution && corner_solution[:owner] == 'A' ? TOP_BLIND_RETURN.to_f : 0.0)].max
          s1 = span[1]
          first_tall = wall_b_base_runs.flat_map { |r| r[:modules] }.find { |m| m['type'] == 'tall_oven' }
          s1 = [s1, first_tall['x0_mm'].to_f].min if first_tall

          if (s1 - s0) >= 200.0
            top_bays = ModuleOptimizer.solve_span_into_modules(s0, s1, 'B', :top)
            wall_b_top_runs << { start_mm: s0, end_mm: s1, bays: top_bays } if top_bays.any?
          end
        end
      end

      wall_c_base_runs = []
      user_c = custom_modules && custom_modules['C'] && custom_modules['C'].any? ? custom_modules['C'] : nil
      if wall_c_len > 0 && layout_type.include?('U_')
        if user_c
          mapped_c = CustomModuleMapper.map_custom_modules_to_spans(user_c, 'C', base_spans_c, nil, wall_c_len)
          wall_c_base_runs << { start_mm: mapped_c.first['x0_mm'], end_mm: mapped_c.last['x1_mm'], modules: mapped_c } if mapped_c.any?
        else
          base_spans_c.each do |span|
            s0, s1 = span[0], span[1]
            c_mods = ModuleOptimizer.solve_span_into_modules(s0, s1, 'C', :base)
            wall_c_base_runs << { start_mm: s0, end_mm: s1, modules: c_mods } if c_mods.any?
          end
        end
      end

      island_base_runs = []
      user_isl = custom_modules && custom_modules['Island'] && custom_modules['Island'].any? ? custom_modules['Island'] : nil
      if isl_len > 0 && layout_type.include?('ISLAND')
        if user_isl
          mapped_isl = CustomModuleMapper.map_custom_modules_to_spans(user_isl, 'Island', [[0.0, isl_len]], nil, isl_len)
          island_base_runs << { start_mm: 0.0, end_mm: isl_len, modules: mapped_isl } if mapped_isl.any?
        else
          isl_mods = ModuleOptimizer.solve_span_into_modules(0.0, isl_len, 'Island', :base)
          island_base_runs << { start_mm: 0.0, end_mm: isl_len, modules: isl_mods } if isl_mods.any?
        end
      end

      flat_modules = {
        'A' => wall_a_base_runs.flat_map { |r| r[:modules] },
        'B' => wall_b_base_runs.flat_map { |r| r[:modules] },
        'C' => wall_c_base_runs.flat_map { |r| r[:modules] },
        'Island' => island_base_runs.flat_map { |r| r[:modules] }
      }

      corner_zones = {}
      if corner_solution && corner_solution[:valid]
        if corner_solution[:owner] == 'A'
          corner_zones['A'] = [[wall_a_len - 1075.0, wall_a_len]]
          corner_zones['B'] = [[0.0, 625.0]]
        else
          corner_zones['A'] = [[wall_a_len - 625.0, wall_a_len]]
          corner_zones['B'] = [[0.0, 1075.0]]
        end
      end

      layout_result = {
        success: true,
        room: room_specs,
        openings: openings,
        corner: corner_solution,
        corner_reserved_zones: corner_zones,
        walls: {
          'A' => { base_runs: wall_a_base_runs, top_runs: wall_a_top_runs },
          'B' => { base_runs: wall_b_base_runs, top_runs: wall_b_top_runs },
          'C' => { base_runs: wall_c_base_runs, top_runs: [] },
          'Island' => { base_runs: island_base_runs, top_runs: [] }
        },
        modules: flat_modules,
        violations: []
      }

      violations = LayoutValidator.validate_layout(layout_result)
      if violations.any?
        layout_result[:success] = false
        layout_result[:violations] = violations
      end

      layout_result
    end

    # -------------------------------------------------------------------------
    # 9. PRELIMINARY BLUEPRINT GENERATOR (FOR AI ARCHITECTURAL AUDIT)
    # -------------------------------------------------------------------------
    def self.generate_preliminary_blueprint(room_specs, openings_list, style = {})
      openings = OpeningConstraint.extract_openings(openings_list)
      wall_a_len = (room_specs['wall_a_mm'] || 2488).to_f
      wall_b_len = (room_specs['wall_b_mm'] || 2379).to_f

      base_spans_a = OpeningConstraint.legal_spans_for('A', wall_a_len, :base, openings)
      top_spans_a  = OpeningConstraint.legal_spans_for('A', wall_a_len, :top,  openings)
      base_spans_b = OpeningConstraint.legal_spans_for('B', wall_b_len, :base, openings)
      top_spans_b  = OpeningConstraint.legal_spans_for('B', wall_b_len, :top,  openings)

      initial_solve = solve_kitchen_layout(room_specs, openings_list, style, nil)

      {
        room: room_specs,
        openings: openings,
        legal_spans: {
          'A' => { base: base_spans_a, top: top_spans_a },
          'B' => { base: base_spans_b, top: top_spans_b }
        },
        preliminary_modules: initial_solve[:modules],
        recommendations: {
          preferred_door_widths: [600, 500, 450],
          avoid_micro_doors_under_mm: 400,
          sink_rule: "Place sink beneath high window (sill >= 870mm) where available.",
          cooker_rule: "Place cooker and extractor hood strictly on solid wall spans away from windows and doors."
        }
      }
    end
  end
end
