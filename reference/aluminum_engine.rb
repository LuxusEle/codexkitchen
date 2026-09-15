require 'sketchup.rb'

# Parametric SketchUp geometry for the Cabinex MDF/aluminum hybrid system.
#
# Coordinate convention (matching the Aluminum reference project):
#   X = left to right, Y = front (-depth) to wall/back (0), Z = bottom to top.
module CBXHybridEngine
  class << self
    attr_accessor :top_door_style, :base_door_style, :tall_unit_style
  end

  PROFILE_WIDTH = 25.4.mm
  PROFILE_HEIGHT = 38.1.mm
  PROFILE_WALL = 1.2.mm
  SASH_THICKNESS = 21.2.mm
  CLADDING_THICKNESS = 3.mm
  ACP_PANEL_THICKNESS = 3.mm
  MAX_BOTTOM_DOOR_WIDTH = 600.mm
  MAX_TOP_DOOR_WIDTH = 600.mm
  PREFERRED_SINGLE_DOOR_MAX = 600.mm
  DEFAULT_MAX_BAY_WIDTH = 600.mm
  MIN_USABLE_CORNER_FRONT = 450.mm
  CUTOUT_CLEARANCE = 0.5.mm
  HOOD_CLEARANCE = 6.inch
  SLIM_HOOD_WIDTH = 600.mm
  DOOR_GAP = 3.mm
  FINGER_FRAME_FACE = 45.mm
  FINGER_FRAME_DEPTH = 21.2.mm
  # User-audited handle section. These remain defaults only: every handle
  # builder accepts :handle_projection, :handle_rise and :handle_wall (with
  # :handle_drop retained as a legacy alias) so the
  # production profile can be changed without rewriting cabinet layout logic.
  FINGER_HANDLE_EXTENSION = 24.mm
  FINGER_HANDLE_LIP_HEIGHT = 32.mm
  FINGER_HANDLE_WALL = 1.5.mm
  FINGER_PULL_CLEARANCE = DOOR_GAP
  ALUMINUM_STOCK_LENGTH = 6400.mm # 21 ft box-bar stock; a continuous run cannot exceed this

  def self.tag_part(group, role, attrs = {})
    group.name = role
    group.set_attribute('CBX', 'role', role)
    attrs.each { |key, value| group.set_attribute('CBX', key.to_s, value) }
    group
  end

  # Paint every outer edge of a profile group black so the aluminum contour
  # reads clearly against its gray face material. Idempotent: uses a shared
  # lazily-created edge material so repeated calls reuse one SketchUp material.
  def self.paint_black_edges(group)
    return group unless group.respond_to?(:entities)
    src = (group.respond_to?(:model) && group.model) || Sketchup.active_model
    return group unless src && src.respond_to?(:materials)
    edge_mat = src.materials['Cabinex Edge Black']
    edge_mat ||= begin
      m = src.materials.add('Cabinex Edge Black')
      m.color = Sketchup::Color.new(10, 10, 10) if m.respond_to?(:color=)
      m
    end
    group.entities.grep(Sketchup::Edge).each { |e| e.material = edge_mat }
    group
  end

  # Authentic ALU SYS contour. X is offset by Z at each end to form 45-degree
  # miter planes; the inner loop is erased to retain the hollow profile.
  def self.create_sash_bar(parent_ents, bar_length, alu_mat, hole_mat, is_hinged = false)
    group = parent_ents.add_group
    group.material = alu_mat

    outer = [
      [21.2, 0], [0, 0], [0, 10], [3.5, 10], [3.5, 8.5],
      [1.5, 8.5], [1.5, 1.5], [5.0, 1.5], [5.0, 45], [21.2, 45]
    ].reverse
    inner = [[6.5, 1.5], [19.7, 1.5], [19.7, 43.5], [6.5, 43.5]].reverse

    start_outer = outer.map { |y, z| Geom::Point3d.new(z.mm, y.mm, z.mm) }
    end_outer = outer.map { |y, z| Geom::Point3d.new(bar_length - z.mm, y.mm, z.mm) }
    start_inner = inner.map { |y, z| Geom::Point3d.new(z.mm, y.mm, z.mm) }
    end_inner = inner.map { |y, z| Geom::Point3d.new(bar_length - z.mm, y.mm, z.mm) }

    start_face = group.entities.add_face(start_outer)
    start_hole = group.entities.add_face(start_inner)
    start_hole.erase! if start_hole && start_hole.valid?
    end_face = group.entities.add_face(end_outer)
    end_hole = group.entities.add_face(end_inner)
    end_hole.erase! if end_hole && end_hole.valid?

    outer.length.times do |index|
      nxt = (index + 1) % outer.length
      group.entities.add_face(start_outer[index], start_outer[nxt], end_outer[nxt], end_outer[index])
    end
    inner.length.times do |index|
      nxt = (index + 1) % inner.length
      group.entities.add_face(start_inner[index], end_inner[index], end_inner[nxt], start_inner[nxt])
    end

    hinge_positions = []
    if is_hinged && bar_length > 200.mm
      hinge_positions = [100.mm, bar_length / 2.0,
                         bar_length - 100.mm].uniq
      hinge_positions.each_with_index do |hinge_x, index|
        marker = group.entities.add_group
        # Bright red disc so hinged doors are instantly visible.
        hinge_mat = group.model ? group.model.materials['Cabinex Hinge Red'] : nil
        hinge_mat ||= Sketchup.active_model.materials['Cabinex Hinge Red'] || Sketchup.active_model.materials.add('Cabinex Hinge Red')
        hinge_mat.color = Sketchup::Color.new(230, 40, 30) if hinge_mat.respond_to?(:color=)
        marker.material = hinge_mat
        circle = marker.entities.add_circle(
          Geom::Point3d.new(hinge_x, 21.2.mm, 22.5.mm),
          Geom::Vector3d.new(0, 1, 0),
          17.5.mm,
          24
        )
        face = marker.entities.add_face(circle)
        face.material = hinge_mat if face
        face.pushpull(-13.mm) if face
        paint_black_edges(marker)
        tag_part(
          marker, "Hinge_Hole_Marker_#{index + 1}",
          'drill_marker' => true,
          'diameter_mm' => 35.0,
          'depth_mm' => 13.0,
          'center_from_bar_end_mm' => hinge_x.to_mm
        )
      end
    end

    paint_black_edges(group)
    tag_part(
      group, 'Sash_Bar',
      'length_mm' => bar_length.to_mm,
      'hinge_hole_count' => hinge_positions.length,
      'hinge_holes_marked' => !hinge_positions.empty?
    )
  end

  def self.build_sash_assembly(parent_ents, door_w, door_h, ox, oy, oz,
                               alu_mat, glass_mat, hole_mat,
                               is_left_hinged = true, panel_mat = nil,
                               assembly_name = nil, door_options = {})
    group = parent_ents.add_group
    sub = group.entities
    transform = Geom::Transformation.translation([ox, oy, oz])

    handle_side = door_options[:handle_side]&.to_sym
    if handle_side == :opening
      handle_side = hinge_left ? :right : :left
    end
    unless [nil, :left, :right, :top, :bottom].include?(handle_side)
      raise ArgumentError, 'Sash handle_side must be :left, :right, :top, :bottom, or nil'
    end

    handle_profile = door_options[:handle_profile] || {}
    rise = handle_profile[:up_rise] || 33.mm

    if handle_side == :left
      door_w -= rise
      ox += rise
    elsif handle_side == :right
      door_w -= rise
    elsif handle_side == :bottom
      door_h -= rise
      oz += rise
    elsif handle_side == :top
      door_h -= rise
    end

    transform = Geom::Transformation.translation([ox, oy, oz])

    mark_hinges = door_options.fetch(:mark_hinges, true)
    hinge_side = is_left_hinged ? :left : :right
    
    if mark_hinges && handle_side == hinge_side
      raise ArgumentError, 'Opening handle cannot replace the hinge stile'
    end

    bottom = if handle_side == :bottom
               create_finger_handle_top_bar(sub, door_w, alu_mat, handle_profile)
             else
               create_sash_bar(sub, door_w, alu_mat, hole_mat, false)
             end
    bottom.transform!(transform)
    paint_black_edges(bottom)

    top = if handle_side == :top
            create_finger_handle_top_bar(sub, door_w, alu_mat, handle_profile)
          else
            create_sash_bar(sub, door_w, alu_mat, hole_mat, false)
          end
    top.transform!(Geom::Transformation.scaling(1, 1, -1))
    top.transform!(Geom::Transformation.translation([0, 0, door_h]))
    top.transform!(transform)
    paint_black_edges(top)

    left = if handle_side == :left
             create_finger_handle_top_bar(sub, door_h, alu_mat, handle_profile)
           else
             create_sash_bar(sub, door_h, alu_mat, hole_mat, mark_hinges && is_left_hinged)
           end
    left.transform!(Geom::Transformation.rotation([0, 0, 0], [0, 1, 0], -90.degrees))
    left.transform!(Geom::Transformation.scaling(-1, 1, 1))
    left.transform!(transform)
    paint_black_edges(left)

    right = if handle_side == :right
              create_finger_handle_top_bar(sub, door_h, alu_mat, handle_profile)
            else
              create_sash_bar(sub, door_h, alu_mat, hole_mat, mark_hinges && !is_left_hinged)
            end
    right.transform!(Geom::Transformation.rotation([0, 0, 0], [0, 1, 0], -90.degrees))
    right.transform!(Geom::Transformation.translation([door_w, 0, 0]))
    right.transform!(transform)
    paint_black_edges(right)

    infill_mode = door_options[:infill]&.to_sym
    unless infill_mode == :none
      pane = sub.add_group
      pane_thickness = panel_mat ? CLADDING_THICKNESS : 3.mm
      pane_y0 = 1.75.mm
      pane_face = pane.entities.add_face(
        [10.mm, pane_y0, 10.mm],
        [door_w - 10.mm, pane_y0, 10.mm],
        [door_w - 10.mm, pane_y0 + pane_thickness, 10.mm],
        [10.mm, pane_y0 + pane_thickness, 10.mm]
      )
      pane_face.pushpull(door_h - 20.mm) if pane_face
      pane.material = panel_mat || glass_mat
      pane.transform!(transform)
      tag_part(
        pane, 'Infill_Pane',
        'width_mm' => (door_w - 20.mm).to_mm,
        'height_mm' => (door_h - 20.mm).to_mm,
        'thickness_mm' => pane_thickness.to_mm,
        'sheet_material' => (panel_mat ? 'ACP' : 'GLASS')
      )
    end

    tag_part(
      group,
      assembly_name ||
        "Alu_Sash_Door_#{door_w.to_mm.round}x#{door_h.to_mm.round}",
      'width_mm' => door_w.to_mm,
      'height_mm' => door_h.to_mm,
      'hinge_side' => hinge_side.to_s.upcase,
      'opening_handle_side' => handle_side&.to_s&.upcase,
      'opening_handle_leg_direction' =>
        (handle_side ? 'INTO_DOOR_LEAF_CHANNEL_OPEN_AT_FREE_EDGE' : nil),
      'infill_mode' => (infill_mode == :none ? 'OPEN' :
                        (panel_mat ? 'ACP' : 'GLASS')),
      'hinge_holes_marked' => mark_hinges
    )
  end

  # Build authentic Sash Door Assembly turned 90 degrees horizontal as an interior glazed shelf
  def self.build_horizontal_sash_shelf(parent_ents, shelf_w, shelf_d, ox, oy, oz,
                                       mats, assembly_name = nil)
    # 1. Generate authentic 4-sided mitered aluminum sash frame with glass infill pane in local XZ plane
    group = build_sash_assembly(
      parent_ents, shelf_w, shelf_d, 0, 0, 0,
      mats[:sash_alu] || mats[:alu], mats[:glass], mats[:hole],
      false, nil, assembly_name || "Aluminum_Sash_Glazed_Shelf_#{shelf_w.to_mm.round}x#{shelf_d.to_mm.round}",
      { mark_hinges: false, handle_side: nil, infill: :glass }
    )

    # 2. Rotate +90 degrees around local X-axis:
    # Transforms X -> X, Y -> Z (upward 21.2mm thickness), Z -> -Y (inward depth towards cabinet front)
    rot_x = Geom::Transformation.rotation([0, 0, 0], [1, 0, 0], 90.degrees)
    trans = Geom::Transformation.translation([ox, oy, oz])
    group.transform!(trans * rot_x)
    group.set_attribute('CBX', 'role', 'Aluminum_Sash_Glazed_Shelf')
    group.set_attribute('CBX', 'width_mm', shelf_w.to_mm)
    group.set_attribute('CBX', 'depth_mm', shelf_d.to_mm)
    group.set_attribute('CBX', 'thickness_mm', SASH_THICKNESS.to_mm)
    group
  end

  def self.create_box_bar(parent_ents, length, width, height, wall,
                          ox, oy, oz, orientation, material, role = nil)
    raise ArgumentError, 'Box-bar length must be positive' unless length > 0

    group = parent_ents.add_group
    case orientation
    when 'X'
      outer = [[0, 0, 0], [0, width, 0], [0, width, height], [0, 0, height]]
      inner = [[0, wall, wall], [0, width - wall, wall], [0, width - wall, height - wall], [0, wall, height - wall]]
      face = group.entities.add_face(outer)
      hole = group.entities.add_face(inner)
      hole.erase! if hole
      face.reverse! if face && face.normal.x < 0
      face.pushpull(length) if face
    when 'Y'
      outer = [[0, 0, 0], [width, 0, 0], [width, 0, height], [0, 0, height]]
      inner = [[wall, 0, wall], [width - wall, 0, wall], [width - wall, 0, height - wall], [wall, 0, height - wall]]
      face = group.entities.add_face(outer)
      hole = group.entities.add_face(inner)
      hole.erase! if hole
      face.reverse! if face && face.normal.y < 0
      face.pushpull(length) if face
    when 'Z'
      outer = [[0, 0, 0], [width, 0, 0], [width, height, 0], [0, height, 0]]
      inner = [[wall, wall, 0], [width - wall, wall, 0], [width - wall, height - wall, 0], [wall, height - wall, 0]]
      face = group.entities.add_face(outer)
      hole = group.entities.add_face(inner)
      hole.erase! if hole
      face.reverse! if face && face.normal.z < 0
      face.pushpull(length) if face
    else
      raise ArgumentError, "Unknown box-bar orientation: #{orientation}"
    end
    group.transform!(Geom::Transformation.translation([ox, oy, oz]))
    group.material = material
    paint_black_edges(group)
    tag_part(group, role || "BoxBar_#{orientation}_#{length.to_mm.round}",
             'orientation' => orientation, 'length_mm' => length.to_mm,
             'profile_width_mm' => width.to_mm, 'profile_height_mm' => height.to_mm)
  end

  # Die-Cast Aluminum 3-Way Corner Joint Connector (25.4mm cube with 3 orthogonal insertion spigots)
  def self.create_corner_joint_3way(parent_ents, ox, oy, oz, size = 25.4.mm, material = nil, role = nil)
    group = parent_ents.add_group
    sub = group.entities
    # 1. Central 25.4mm cube core
    f = sub.add_face(
      [0, 0, 0], [size, 0, 0],
      [size, size, 0], [0, size, 0]
    )
    f.reverse! if f && f.normal.z < 0
    f.pushpull(size) if f

    # 2. Insert spigots extending 12mm in X, Y, Z for authentic mechanical joint representation
    p_inset = 2.mm
    p_len = 12.mm
    
    # +X insertion spigot
    fx = sub.add_face([size, p_inset, p_inset], [size, size - p_inset, p_inset], [size, size - p_inset, size - p_inset], [size, p_inset, size - p_inset])
    fx.pushpull(p_len) if fx

    # +Y insertion spigot
    fy = sub.add_face([p_inset, size, p_inset], [size - p_inset, size, p_inset], [size - p_inset, size, size - p_inset], [p_inset, size, size - p_inset])
    fy.pushpull(p_len) if fy

    # +Z insertion spigot
    fz = sub.add_face([p_inset, p_inset, size], [size - p_inset, p_inset, size], [size - p_inset, size - p_inset, size], [p_inset, size - p_inset, size])
    fz.pushpull(p_len) if fz

    group.transform!(Geom::Transformation.translation([ox, oy, oz]))
    group.material = material
    tag_part(group, role || "DieCast_3Way_Corner_Joint_#{size.to_mm.round}mm",
             'role' => 'Corner_Joint_Connector',
             'connector_type' => '3WAY_DIECAST_ALUMINUM_INSERT',
             'cube_size_mm' => size.to_mm,
             'is_hardware_joint' => true)
    group
  end

  def self.create_solid_box(parent_ents, name, px, py, pz, dx, dy, dz, material)
    raise ArgumentError, "#{name} has a non-positive dimension" unless dx > 0 && dy > 0 && dz > 0

    group = parent_ents.add_group
    face = group.entities.add_face(
      [px, py, pz], [px + dx, py, pz],
      [px + dx, py + dy, pz], [px, py + dy, pz]
    )
    if face
      face.reverse! if face.normal.z < 0
      face.pushpull(dz)
    end
    group.material = material
    tag_part(group, name, 'x_mm' => dx.to_mm, 'y_mm' => dy.to_mm, 'z_mm' => dz.to_mm)
  end

  def self.merge_intervals(intervals, lower, upper)
    clipped = intervals.map { |a, b| [[a, lower].max, [b, upper].min] }
                       .select { |a, b| b > a }
                       .sort_by { |a, _b| a }
    merged = []
    clipped.each do |interval|
      if merged.empty? || interval[0] > merged[-1][1]
        merged << interval.dup
      else
        merged[-1][1] = [merged[-1][1], interval[1]].max
      end
    end
    merged
  end

  def self.free_segments(lower, upper, blocked)
    cursor = lower
    result = []
    merge_intervals(blocked, lower, upper).each do |a, b|
      result << [cursor, a] if a > cursor
      cursor = [cursor, b].max
    end
    result << [cursor, upper] if upper > cursor
    result
  end

  # Cabinex panel method: create one rectangular solid, draw each U-notch on
  # its top face, then push/pull through the sheet. Each ACP/glass sheet remains
  # one selectable manufacturing group with no Full/Bridge child pieces.
  def self.create_notched_horizontal_panel(parent_ents, name, x0, y0, z0,
                                           width, depth, thickness,
                                           blocked_x, front_cut_depth,
                                           back_cut_depth, material)
    panel = parent_ents.add_group
    intervals = merge_intervals(blocked_x, x0, x0 + width)
    if front_cut_depth + back_cut_depth >= depth
      raise ArgumentError, "#{name} notch depths consume the panel"
    end

    face = panel.entities.add_face(
      [x0, y0, z0], [x0 + width, y0, z0],
      [x0 + width, y0 + depth, z0], [x0, y0 + depth, z0]
    )
    raise "Could not create #{name}" unless face

    face.reverse! if face.normal.z < 0
    face.pushpull(thickness)
    cut_z = z0 + thickness
    intervals.each do |a, b|
      [[y0, front_cut_depth],
       [y0 + depth - back_cut_depth, back_cut_depth]].each do |cut_y, cut_depth|
        notch = panel.entities.add_face(
          [a, cut_y, cut_z], [b, cut_y, cut_z],
          [b, cut_y + cut_depth, cut_z], [a, cut_y + cut_depth, cut_z]
        )
        raise "Could not cut #{name} notch" unless notch

        notch.reverse! if notch.normal.z < 0
        notch.pushpull(-thickness)
      end
    end

    panel.material = material
    tag_part(panel, name,
             'construction' => 'CABINETRIX_SINGLE_SOLID_THROUGH_NOTCH',
             'nesting_type' => '2D_SHEET',
             'width_mm' => width.to_mm, 'depth_mm' => depth.to_mm,
             'thickness_mm' => thickness.to_mm,
             'sheet_material' => 'ACP',
             'cutout_count' => intervals.length,
             'nested_group_count' => 0)
  end

  # Rear sheet uses the same Cabinex solid-and-cut method. It sits just
  # inside the rearmost frame; shallow bottom/top cuts clear the post joints
  # while leaving one connected back sheet.
  def self.create_back_cladding(parent_ents, x0, x1, y, z, height,
                                blocked_x, material)
    group = parent_ents.add_group
    intervals = merge_intervals(blocked_x, x0, x1)
    face = group.entities.add_face(
      [x0, y, z], [x1, y, z],
      [x1, y, z + height], [x0, y, z + height]
    )
    raise 'Could not create rear ACP sheet' unless face

    face.reverse! if face.normal.y < 0
    face.pushpull(CLADDING_THICKNESS)
    cut_y = y + CLADDING_THICKNESS
    notch_depth = [PROFILE_HEIGHT - PROFILE_WIDTH + CUTOUT_CLEARANCE,
                   height / 4.0].min
    intervals.each do |a, b|
      [[z, notch_depth],
       [z + height - notch_depth, notch_depth]].each do |cut_z, cut_height|
        notch = group.entities.add_face(
          [a, cut_y, cut_z], [b, cut_y, cut_z],
          [b, cut_y, cut_z + cut_height],
          [a, cut_y, cut_z + cut_height]
        )
        raise 'Could not cut rear ACP notch' unless notch

        notch.reverse! if notch.normal.y < 0
        notch.pushpull(-CLADDING_THICKNESS)
      end
    end
    group.material = material
    tag_part(group, 'Clad_Back',
             'construction' => 'CABINETRIX_SINGLE_SOLID_THROUGH_NOTCH',
             'nesting_type' => '2D_SHEET',
             'width_mm' => (x1 - x0).to_mm,
             'height_mm' => height.to_mm,
             'thickness_mm' => CLADDING_THICKNESS.to_mm,
             'sheet_material' => 'ACP',
             'cutout_count' => intervals.length,
             'nested_group_count' => 0,
             'seat' => 'ON_REAR_RAIL_CABINET_FACE')
  end

  def self.structural_divisions(x0, x1, opts)
    width = x1 - x0
    manual = opts[:division_positions]
    # An explicit empty array means an intentionally clear span (for example
    # a doorless aluminum display box). Nil alone requests automatic bays.
    if manual
      positions = manual.map { |offset| x0 + offset }
      return positions.select { |position| position > x0 && position < x1 }.sort
    end
    explicit = opts[:bay_count] ? opts[:bay_count].to_i : 0
    max_width = opts[:max_bay_width] || 1000.mm
    raise ArgumentError, 'Maximum bay width must be positive' unless max_width > 0
    calculated = (width / max_width).ceil
    count = [explicit, calculated, 1].max
    (1...count).map { |index| x0 + width * index / count.to_f }
  end

  def self.validate_top_dimensions!(width, height, depth, rail_length)
    min_rail = [5.mm, width / 4.0].min
    raise ArgumentError, 'Top cabinet width is too small for its sash ends' unless rail_length >= min_rail
    raise ArgumentError, 'Top cabinet height is too small for the frame' unless height > PROFILE_HEIGHT
    raise ArgumentError, 'Top cabinet depth is too small for front/back rails' unless depth > PROFILE_HEIGHT
  end

  def self.validate_required_frame_parts!(frame, required_roles, context)
    names = frame.entities.grep(Sketchup::Group).map(&:name)
    missing = required_roles.reject { |role| names.include?(role) }
    unless missing.empty?
      raise ArgumentError,
            "#{context} is missing required parts: #{missing.join(', ')}"
    end
    frame.set_attribute('CBX', 'required_frame_parts_validated', true)
    frame.set_attribute('CBX', 'frame_validation_context', context)
    true
  end

  # Every wall/top component publishes its nominal row datum and actual top.
  # Validate after assembling a run so a single default-height cabinet cannot
  # silently jump above or below its neighbours again.
  def self.validate_wall_row_alignment!(parent_ents, tolerance = 0.5.mm)
    groups = parent_ents.grep(Sketchup::Group).select do |group|
      group.get_attribute('CBX', 'alignment_class') == 'WALL_TOP'
    end
    return true if groups.empty?

    missing_metadata = groups.select do |group|
      group.get_attribute('CBX', 'top_z_mm').nil? ||
        group.get_attribute('CBX', 'nominal_bottom_z_mm').nil? ||
        group.get_attribute('CBX', 'front_alignment_valid').nil?
    end
    unless missing_metadata.empty?
      raise ArgumentError,
            "Wall-row alignment metadata missing in #{missing_metadata.map(&:name).join(', ')}"
    end

    tolerance_mm = tolerance.respond_to?(:to_mm) ? tolerance.to_mm : tolerance.to_f
    top_values = groups.map do |group|
      group.get_attribute('CBX', 'top_z_mm').to_f
    end
    datum_values = groups.map do |group|
      group.get_attribute('CBX', 'nominal_bottom_z_mm').to_f
    end
    errors = []
    if top_values.max - top_values.min > tolerance_mm
      errors << "top Z #{top_values.map { |value| value.round(2) }.join(', ')}"
    end
    if datum_values.max - datum_values.min > tolerance_mm
      errors <<
        "row datum #{datum_values.map { |value| value.round(2) }.join(', ')}"
    end
    front_failures = groups.reject do |group|
      group.get_attribute('CBX', 'front_alignment_valid') != false
    end
    unless front_failures.empty?
      errors <<
        "front depth invalid in #{front_failures.map(&:name).join(', ')}"
    end
    unless errors.empty?
      raise ArgumentError, "Wall-row alignment failed: #{errors.join('; ')}"
    end

    groups.each do |group|
      group.set_attribute('CBX', 'wall_row_alignment_validated', true)
    end
    true
  end

  # Authoritative production construction: Gola, grooved MDF backs, and
  # corrected aluminum/board cabinet builders. Kept here so every runner
  # consumes one engine implementation.
  GOLA_WALL = 1.5.mm unless const_defined?(:GOLA_WALL)
  GOLA_DEPTH = 26.mm unless const_defined?(:GOLA_DEPTH) # Shotgun side cut
  L_GOLA_HEIGHT = 59.mm unless const_defined?(:L_GOLA_HEIGHT)
  C_GOLA_HEIGHT = 73.5.mm unless const_defined?(:C_GOLA_HEIGHT)
  GOLA_PROFILE_DEPTH = 27.2.mm unless const_defined?(:GOLA_PROFILE_DEPTH)
  L_GOLA_PROFILE_HEIGHT = 56.5.mm unless const_defined?(:L_GOLA_PROFILE_HEIGHT)
  C_GOLA_PROFILE_HEIGHT = 73.mm unless const_defined?(:C_GOLA_PROFILE_HEIGHT)
  GOLA_PROFILE_PROJECTION = GOLA_PROFILE_DEPTH - GOLA_DEPTH unless const_defined?(:GOLA_PROFILE_PROJECTION)
  GOLA_TOP_HAND_GAP = 45.mm unless const_defined?(:GOLA_TOP_HAND_GAP)
  GOLA_DRAWER_HAND_GAP = 30.mm unless const_defined?(:GOLA_DRAWER_HAND_GAP)
  PLINTH_COVER_THICKNESS = 18.mm unless const_defined?(:PLINTH_COVER_THICKNESS)
  PLINTH_COVER_CLEARANCE = 2.mm unless const_defined?(:PLINTH_COVER_CLEARANCE)
  PLINTH_FRONT_SETBACK = 50.mm unless const_defined?(:PLINTH_FRONT_SETBACK)
  PLINTH_STOCK_LENGTH = 2438.mm unless const_defined?(:PLINTH_STOCK_LENGTH)
  GOLA_STOCK_LENGTH = 6000.mm unless const_defined?(:GOLA_STOCK_LENGTH)

  # Extrudes a profile along X and records it as a 1D-nestable aluminum bar.
  def self.create_gola_profile_bar(parent_ents, profile_type, length,
                                   ox, oy, oz, material)
    # SCILM-style horizontal profiles. The simplified thin-wall contour keeps
    # the rounded finger-return logic visible while remaining a manufacturable
    # 1D extrusion. Shotgun's larger cut envelopes provide installation room.
    yz = if profile_type == :l
           [
             [0, 0], [GOLA_WALL, 0], [GOLA_WALL, 44.mm],
             [2.mm, 48.mm], [5.mm, 51.mm], [9.mm, 53.mm],
             [GOLA_PROFILE_DEPTH, 53.mm],
             [GOLA_PROFILE_DEPTH, L_GOLA_PROFILE_HEIGHT],
             [8.mm, L_GOLA_PROFILE_HEIGHT], [4.mm, 55.mm],
             [1.mm, 52.mm], [0, 48.mm]
           ]
         elsif profile_type == :c
           [
             [GOLA_PROFILE_DEPTH, 0], [GOLA_PROFILE_DEPTH, 3.5.mm],
             [9.mm, 3.5.mm], [5.mm, 5.mm], [2.mm, 8.mm],
             [GOLA_WALL, 12.mm],
             [GOLA_WALL, C_GOLA_PROFILE_HEIGHT - 12.mm],
             [2.mm, C_GOLA_PROFILE_HEIGHT - 8.mm],
             [5.mm, C_GOLA_PROFILE_HEIGHT - 5.mm],
             [9.mm, C_GOLA_PROFILE_HEIGHT - 3.5.mm],
             [GOLA_PROFILE_DEPTH, C_GOLA_PROFILE_HEIGHT - 3.5.mm],
             [GOLA_PROFILE_DEPTH, C_GOLA_PROFILE_HEIGHT],
             [8.mm, C_GOLA_PROFILE_HEIGHT],
             [4.mm, C_GOLA_PROFILE_HEIGHT - 1.5.mm],
             [1.mm, C_GOLA_PROFILE_HEIGHT - 4.5.mm],
             [0, C_GOLA_PROFILE_HEIGHT - 9.mm],
             [0, 9.mm], [1.mm, 4.5.mm], [4.mm, 1.5.mm], [8.mm, 0]
           ]
         else
           raise ArgumentError, "Unknown Gola profile: #{profile_type}"
         end

    # The source contour was drawn looking from the cabinet interior. Mirror
    # it through its depth so the finger recess opens toward the room/front
    # (negative global Y) and the fixing spine sits against the carcass.
    yz = yz.map { |y, z| [GOLA_PROFILE_DEPTH - y, z] }
    # The L profile has its finger return at the bottom of the undertop
    # opening. Only its vertical direction is flipped; its front-facing
    # finger recess above remains unchanged.
    if profile_type == :l
      yz = yz.map { |y, z| [y, L_GOLA_PROFILE_HEIGHT - z] }
    end

    group = parent_ents.add_group
    points = yz.map { |y, z| Geom::Point3d.new(0, y, z) }
    face = group.entities.add_face(points)
    raise "Could not create #{profile_type.to_s.upcase}-Gola profile" unless face

    face.reverse! if face.normal.x < 0
    face.pushpull(length)
    group.transform!(Geom::Transformation.translation([ox, oy, oz]))
    group.material = material
    label = profile_type == :l ? 'L_Gola_Profile' : 'C_Gola_Profile'
    tag_part(
      group,
      "#{label}_#{length.to_mm.round}",
      'profile_type' => profile_type.to_s.upcase,
      'length_mm' => length.to_mm,
      'nesting_type' => '1D_BAR',
      'stock_length_mm' => 6400,
      'actual_depth_mm' => GOLA_PROFILE_DEPTH.to_mm,
      'actual_height_mm' => (profile_type == :l ? L_GOLA_PROFILE_HEIGHT : C_GOLA_PROFILE_HEIGHT).to_mm,
      'cut_envelope_depth_mm' => GOLA_DEPTH.to_mm,
      'cut_envelope_height_mm' => (profile_type == :l ? L_GOLA_HEIGHT : C_GOLA_HEIGHT).to_mm,
      'front_projection_mm' => GOLA_PROFILE_PROJECTION.to_mm,
      'opening_direction' => 'FRONT_NEGATIVE_Y'
    )
  end

  # Recreates Shotgun's side-panel machining literally: make one solid side,
  # draw each pocket on its front face, then push/pull 26 mm into that solid.
  # This preserves one machinable side panel rather than assembling a rear
  # slab with separate front pieces around visually simulated openings.
  def self.build_gola_cut_side(parent_ents, role, x, width, depth,
                               base_z, top_z, cutouts, material)
    group = parent_ents.add_group
    ents = group.entities
    panel_face = ents.add_face(
      [x, -depth, base_z], [x + width, -depth, base_z],
      [x + width, 0, base_z], [x, 0, base_z]
    )
    raise "Could not create #{role} side panel" unless panel_face

    panel_face.reverse! if panel_face.normal.z < 0
    panel_face.pushpull(top_z - base_z)

    machined = merge_intervals(cutouts, base_z, top_z)
    machined.each do |z0, z1|
      pocket_face = ents.add_face(
        [x, -depth, z0], [x + width, -depth, z0],
        [x + width, -depth, z1], [x, -depth, z1]
      )
      next unless pocket_face

      pocket_face.reverse! if pocket_face.normal.y > 0
      pocket_face.pushpull(-GOLA_DEPTH)
    end
    cutouts_data = machined.map do |z0, z1|
      {
        edge: 'front',
        z_start_mm: (z0 - base_z).to_mm,
        z_end_mm: (z1 - base_z).to_mm,
        depth_mm: GOLA_DEPTH.to_mm
      }
    end

    group.material = material
    tag_part(group, "#{role}_Machined_Gola_Side",
             'construction' => 'SINGLE_SOLID_PUSH_PULL_NOTCH',
             'cutout_count' => machined.length,
             'cut_depth_mm' => GOLA_DEPTH.to_mm,
             'cutouts_json' => cutouts_data.to_json)
  end

  # Shotgun creates one long plinth cover across the complete cabinet run.
  # Cabinet attributes let this routine discover and merge adjacent base and
  # tall units, so future AI layouts do not calculate the cover manually.
  def self.build_merged_plinth_runs(parent_ents, material)
    specs = parent_ents.grep(Sketchup::Group).map do |cabinet|
      next unless cabinet.get_attribute('CBX', 'requires_plinth_cover') == true

      {
        x0: cabinet.get_attribute('CBX', 'origin_x_mm').to_f.mm,
        x1: (cabinet.get_attribute('CBX', 'origin_x_mm').to_f +
             cabinet.get_attribute('CBX', 'width_mm').to_f).mm,
        y: cabinet.get_attribute('CBX', 'origin_y_mm').to_f.mm,
        z: cabinet.get_attribute('CBX', 'origin_z_mm').to_f.mm,
        depth: cabinet.get_attribute('CBX', 'depth_mm').to_f.mm,
        plinth: cabinet.get_attribute('CBX', 'plinth_height_mm').to_f.mm,
        source_count: 1
      }
    end.compact.sort_by { |spec| spec[:x0] }

    runs = []
    tolerance = 2.0.mm
    specs.each do |spec|
      current = runs[-1]
      same_line = current &&
                  (current[:y] - spec[:y]).abs <= tolerance &&
                  (current[:z] - spec[:z]).abs <= tolerance &&
                  (current[:depth] - spec[:depth]).abs <= tolerance &&
                  (current[:plinth] - spec[:plinth]).abs <= tolerance
      touching = current && spec[:x0] <= current[:x1] + tolerance
      if same_line && touching
        current[:x1] = [current[:x1], spec[:x1]].max
        current[:source_count] += 1
      else
        runs << spec.dup
      end
    end

    piece_number = 0
    runs.each_with_index do |run, run_index|
      cover_height = [run[:plinth] - PLINTH_COVER_CLEARANCE, 1.mm].max
      current_x = run[:x0]
      remaining = run[:x1] - run[:x0]
      while remaining > 0.mm
        piece_number += 1
        piece_width = [remaining, PLINTH_STOCK_LENGTH].min
        cover = create_solid_box(
          parent_ents, "Merged_Plinth_Run_#{run_index + 1}_Piece_#{piece_number}",
          current_x, run[:y] - run[:depth] + PLINTH_FRONT_SETBACK,
          run[:z], piece_width, PLINTH_COVER_THICKNESS,
          cover_height, material
        )
        cover.set_attribute('CBX', 'merged_unit_count', run[:source_count])
        cover.set_attribute('CBX', 'front_setback_mm', PLINTH_FRONT_SETBACK.to_mm)
        cover.set_attribute('CBX', 'stock_length_mm', PLINTH_STOCK_LENGTH.to_mm)
        current_x += piece_width
        remaining -= piece_width
      end
    end
    runs
  end

  # Collinear Gola is purchased and installed as a continuous extrusion, like
  # a plinth run. Adjacent cabinets share one bar; a cut is introduced only
  # when the 6000 mm stock length is reached. Web/waste between cabinets is 0.
  def self.build_merged_gola_runs(parent_ents, material)
    specs = []
    parent_ents.grep(Sketchup::Group).each do |cabinet|
      next unless cabinet.get_attribute('CBX', 'gola_enabled') == true

      x0 = cabinet.get_attribute('CBX', 'origin_x_mm').to_f.mm
      width = cabinet.get_attribute('CBX', 'width_mm').to_f.mm
      origin_y = cabinet.get_attribute('CBX', 'origin_y_mm').to_f.mm
      origin_z = cabinet.get_attribute('CBX', 'origin_z_mm').to_f.mm
      depth = cabinet.get_attribute('CBX', 'depth_mm').to_f.mm
      height = cabinet.get_attribute('CBX', 'height_mm').to_f.mm
      plinth = cabinet.get_attribute('CBX', 'plinth_height_mm').to_f.mm
      subtype = cabinet.get_attribute('CBX', 'subtype').to_s
      drawer_count = cabinet.get_attribute('CBX', 'drawers_count').to_i
      drawer_count = 3 if drawer_count < 1
      y = origin_y - depth - GOLA_PROFILE_PROJECTION

      specs << {
        type: :l, x0: x0, x1: x0 + width, y: y,
        z: origin_z + height - L_GOLA_PROFILE_HEIGHT,
        source_count: 1
      }

      next unless subtype == 'drawers'

      front_bottom = plinth + 3.mm
      front_top = height - GOLA_TOP_HAND_GAP
      visible_gap = GOLA_DRAWER_HAND_GAP
      front_height = (front_top - front_bottom -
                      visible_gap * (drawer_count - 1)) / drawer_count.to_f
      (1...drawer_count).each do |index|
        gap_center = front_bottom + index * front_height +
                     (index - 0.5) * visible_gap
        specs << {
          type: :c, x0: x0, x1: x0 + width, y: y,
          z: origin_z + gap_center - C_GOLA_PROFILE_HEIGHT / 2.0,
          source_count: 1
        }
      end
    end

    tolerance = 2.0.mm
    runs = []
    specs.sort_by { |spec| [spec[:type].to_s, spec[:y], spec[:z], spec[:x0]] }
         .each do |spec|
      current = runs[-1]
      same_line = current && current[:type] == spec[:type] &&
                  (current[:y] - spec[:y]).abs <= tolerance &&
                  (current[:z] - spec[:z]).abs <= tolerance
      touching = current && spec[:x0] <= current[:x1] + tolerance
      if same_line && touching
        current[:x1] = [current[:x1], spec[:x1]].max
        current[:source_count] += 1
      else
        runs << spec.dup
      end
    end

    piece_number = 0
    runs.each_with_index do |run, run_index|
      current_x = run[:x0]
      remaining = run[:x1] - run[:x0]
      while remaining > 0.mm
        piece_number += 1
        piece_length = [remaining, GOLA_STOCK_LENGTH].min
        bar = create_gola_profile_bar(
          parent_ents, run[:type], piece_length,
          current_x, run[:y], run[:z], material
        )
        label = run[:type] == :l ? 'L' : 'C'
        tag_part(
          bar, "Merged_#{label}_Gola_Run_#{run_index + 1}_Piece_#{piece_number}",
          'merged_cabinet_count' => run[:source_count],
          'stock_length_mm' => GOLA_STOCK_LENGTH.to_mm,
          'web_waste_mm' => 0,
          'join_rule' => 'COLLINEAR_ADJACENT_CABINETS'
        )
        current_x += piece_length
        remaining -= piece_length
      end
    end
    runs
  end

  # Corrected aluminum orientation:
  # front/doors = Y=-depth, wall/back = Y=0.
  def self.build_aluminum_top_cabinet(parent_ents, opts, mats)
    width = opts[:width] || 965.mm
    height = opts[:height] || 610.mm
    depth = opts[:depth] || 350.mm
    ox = opts[:x] || 0
    oy = opts[:y] || 0
    oz = opts[:z] || 1500.mm
    has_left_sash = opts[:has_left_sash] == true
    has_right_sash = opts[:has_right_sash] == true
    inward_end_sash_faces = opts[:inward_end_sash_faces] == true
    top_front_rail_setback = opts[:top_front_rail_setback] || 0.mm

    rail_x0 = has_left_sash ? SASH_THICKNESS : 0
    rail_x1 = width - (has_right_sash ? SASH_THICKNESS : 0)
    rail_length = rail_x1 - rail_x0
    validate_top_dimensions!(width, height, depth, rail_length)

    cabinet = parent_ents.add_group
    sub = cabinet.entities
    pw = PROFILE_WIDTH
    ph = PROFILE_HEIGHT
    wall = PROFILE_WALL
    mid_z = height / 2.0 - ph / 2.0
    post_length = height - 2 * ph
    top_z = height - ph
    default_end_mode = opts[:end_sash_panel] || :glass
    left_end_mode = opts.key?(:left_end_panel) ?
                      opts[:left_end_panel] : default_end_mode
    right_end_mode = opts.key?(:right_end_panel) ?
                       opts[:right_end_panel] : default_end_mode
    left_end_material = left_end_mode == :acp ? mats[:acp] : nil
    right_end_material = right_end_mode == :acp ? mats[:acp] : nil

    [['Bottom', 0], ['Top', top_z]].each do |level, z|
      front_y = level == 'Top' ? -depth + top_front_rail_setback : -depth
      create_box_bar(sub, rail_length, pw, ph, wall, rail_x0, front_y, z,
                     'X', mats[:alu], "#{level}_Front_Rail")
      create_box_bar(sub, rail_length, pw, ph, wall, rail_x0, -pw, z,
                     'X', mats[:alu], "#{level}_Back_Rail")
    end

    if has_left_sash
      side = build_sash_assembly(
        sub, depth, height, 0, 0, 0,
        mats[:alu], mats[:glass], mats[:hole], false, left_end_material,
        'Left_Sash_End', { infill: left_end_mode, mark_hinges: false }
      )
      matrix = if inward_end_sash_faces
                 [0, -1, 0, 0, -1, 0, 0, 0,
                  0, 0, 1, 0, SASH_THICKNESS, 0, 0, 1]
               else
                 [0, -1, 0, 0, 1, 0, 0, 0,
                  0, 0, 1, 0, 0, 0, 0, 1]
               end
      side.transform!(Geom::Transformation.new(matrix))
    end
    if has_right_sash
      side = build_sash_assembly(
        sub, depth, height, 0, 0, 0,
        mats[:alu], mats[:glass], mats[:hole], false, right_end_material,
        'Right_Sash_End', { infill: right_end_mode, mark_hinges: false }
      )
      matrix = if inward_end_sash_faces
                 [0, -1, 0, 0, 1, 0, 0, 0,
                  0, 0, 1, 0, width - SASH_THICKNESS, 0, 0, 1]
               else
                 [0, -1, 0, 0, -1, 0, 0, 0,
                  0, 0, 1, 0, width, 0, 0, 1]
               end
      side.transform!(Geom::Transformation.new(matrix))
    end

    nodes = []
    nodes << { x: rail_x0, role: 'Left_End' } unless has_left_sash
    structural_divisions(rail_x0, rail_x1, opts).each_with_index do |center, index|
      nodes << { x: center - pw / 2.0, role: "Division_#{index + 1}" }
    end
    nodes << { x: rail_x1 - pw, role: 'Right_End' } unless has_right_sash

    add_strut_pair = lambda do |node|
      x = node[:x]
      role = node[:role]
      create_box_bar(sub, depth - 2 * pw, pw, ph, wall, x, -depth + pw, 0,
                     'Y', mats[:alu], "#{role}_Bottom_Strut")
      create_box_bar(sub, depth - 2 * pw, pw, ph, wall, x, -depth + pw, top_z,
                     'Y', mats[:alu], "#{role}_Top_Strut")
    end

    nodes.each do |node|
      x = node[:x]
      role = node[:role]
      create_box_bar(sub, post_length, pw, ph, wall, x, -depth, ph,
                     'Z', mats[:alu], "#{role}_Front_Upright")
      create_box_bar(sub, post_length, pw, ph, wall, x, -ph, ph,
                     'Z', mats[:alu], "#{role}_Back_Upright")
      add_strut_pair.call(node)
    end

    sash_support_nodes = []
    sash_support_nodes << { x: rail_x0, role: 'Left_Sash_End' } if has_left_sash
    sash_support_nodes << { x: rail_x1 - pw, role: 'Right_Sash_End' } if has_right_sash

    blocked_x = nodes.map do |node|
      [node[:x] - CUTOUT_CLEARANCE, node[:x] + pw + CUTOUT_CLEARANCE]
    end
    
    shelf_count = if opts[:shelves] == :none
                    0
                  elsif opts.key?(:shelf_count)
                    opts[:shelf_count].to_i
                  else
                    (height > 1200.mm ? 3 : 1)
                  end
    shelf_zs = (1..shelf_count).map { |i| height * i / (shelf_count + 1.0) - ph / 2.0 }
    panel_depth = depth - 2 * pw
    notch_depth = [pw, ph].min

    shelf_zs.each_with_index do |sz, s_index|
      # 1. Depth support struts at each connected structural node
      nodes.each do |node|
        create_box_bar(sub, depth - 2 * ph, pw, ph, wall, node[:x], -depth + ph, sz,
                       'Y', mats[:alu], "#{node[:role]}_Shelf_#{s_index + 1}_Strut")
      end

      # 2. Front & Back horizontal support rails spanning continuously between connected upright posts
      free_segments(rail_x0, rail_x1, blocked_x).each_with_index do |(a, b), b_index|
        bay_w = b - a
        create_box_bar(sub, bay_w, pw, ph, wall, a, -depth + pw, sz,
                       'X', mats[:alu], "Bay_#{b_index + 1}_Shelf_#{s_index + 1}_Front_Rail")
        create_box_bar(sub, bay_w, pw, ph, wall, a, -ph, sz,
                       'X', mats[:alu], "Bay_#{b_index + 1}_Shelf_#{s_index + 1}_Back_Rail")
      end

      # 3. Continuous horizontal ACP shelf panel resting on top of the support rails (at Z = sz + ph)
      # Notched cleanly around all vertical upright posts
      create_notched_horizontal_panel(
        sub, "Clad_Shelf_#{s_index + 1}", rail_x0, -depth + pw, sz + ph,
        rail_length, panel_depth, CLADDING_THICKNESS,
        blocked_x, notch_depth, notch_depth, mats[:acp]
      )
    end

    panel_depth = depth - 2 * pw
    notch_depth = [pw, ph].min
    create_notched_horizontal_panel(
      sub, 'Clad_Bottom', rail_x0, -depth + pw, ph,
      rail_length, panel_depth, CLADDING_THICKNESS,
      blocked_x, notch_depth, notch_depth, mats[:acp]
    )
    create_notched_horizontal_panel(
      sub, 'Clad_Top', rail_x0, -depth + pw,
      height - ph - CLADDING_THICKNESS,
      rail_length, panel_depth, CLADDING_THICKNESS,
      blocked_x, notch_depth, notch_depth, mats[:acp]
    )

    # Seat the rear ACP directly on the cabinet-facing surface of the rear
    # horizontal rails at Y=-PW. The one-piece sheet retains its upright
    # clearance notches and is no longer left floating PH-PW in front of them.
    create_back_cladding(
      sub, rail_x0, rail_x1, -pw - CLADDING_THICKNESS, ph,
      height - 2 * ph, blocked_x, mats[:acp]
    )

    gap = 3.mm
    if opts[:doors] != :none
      door_count = opts[:door_count] ? opts[:door_count].to_i : 0
      max_leaf = opts[:max_door_width] || MAX_TOP_DOOR_WIDTH
      door_count = [(rail_length / max_leaf).ceil, 1].max if door_count < 1
      # Aluminum advanced-mode end rule: the side sash stops at the carcass
      # front plane, while the outer front door covers its 21.2 mm end width.
      # Standard box-bar ends retain their normal 3 mm reveal.
      door_x0 = has_left_sash ? 0 : rail_x0 + gap
      door_x1 = has_right_sash ? width : rail_x1 - gap
      door_span = door_x1 - door_x0
      leaf_width = (door_span - gap * (door_count - 1)) / door_count.to_f
      requested_handle_side = if opts.key?(:door_handle_side)
                                opts[:door_handle_side]&.to_sym
                              elsif height >= 1200.mm
                                :opening
                              end
      handle_profile = opts[:handle_profile] || {}
      door_count.times do |index|
        hinge_left = (door_count == 2) ? (index == 0) : index.even?
        handle_side = if door_count == 1
                        (requested_handle_side == :opening || requested_handle_side.nil?) ? (hinge_left ? :right : :left) : requested_handle_side
                      elsif door_count == 2
                        hinge_left ? :right : :left
                      else
                        hinge_left ? :right : :left
                      end
        build_sash_assembly(
          sub, leaf_width, height - 2 * gap,
          door_x0 + index * (leaf_width + gap),
          -depth - SASH_THICKNESS, gap,
          mats[:alu], mats[:glass], mats[:hole], hinge_left, nil,
          "Front_Sash_Door_#{index + 1}",
          { handle_side: handle_side, handle_profile: handle_profile }
        )
      end
    end

    cabinet.transform!(Geom::Transformation.translation([ox, oy, oz]))
    assembly_role = opts[:assembly_role] || "Alu_Top_Cabinet_#{width.to_mm.round}"
    alignment_class = opts[:alignment_class]
    if alignment_class.nil? && oz >= 1000.mm && height < 1000.mm
      alignment_class = 'WALL_TOP'
    end
    tag_part(
      cabinet, assembly_role,
      'width_mm' => width.to_mm,
      'height_mm' => height.to_mm,
      'depth_mm' => depth.to_mm,
      'front_y_mm' => -depth.to_mm,
      'back_y_mm' => 0,
      'has_left_sash' => has_left_sash,
      'has_right_sash' => has_right_sash,
      'structural_node_count' => nodes.length + sash_support_nodes.length,
      'sash_end_is_frame' => true,
      'side_sash_depth_mm' => depth.to_mm,
      'front_door_overlaps_side_sash' => true,
      'left_end_sash_infill' => left_end_mode.to_s.upcase,
      'right_end_sash_infill' => right_end_mode.to_s.upcase,
      'end_sash_finished_faces_direction' =>
        (inward_end_sash_faces ? 'INWARD' : 'OUTWARD'),
      'top_front_rail_setback_mm' => top_front_rail_setback.to_mm,
      'end_sash_infill' => if left_end_mode == right_end_mode
                             left_end_mode.to_s.upcase
                           else
                             'MIXED'
                           end,
      'alignment_class' => alignment_class,
      'nominal_bottom_z_mm' =>
        (opts[:nominal_bottom_z] || oz).to_mm,
      'top_z_mm' => (oz + height).to_mm,
      'front_face_y_mm' => (oy - depth - SASH_THICKNESS).to_mm,
      'front_alignment_valid' => true,
      'opening_handle_side' => if opts[:doors] != :none && height >= 1200.mm
                                 (opts[:door_handle_side] ||
                                  :opening).to_s.upcase
                               else
                                 opts[:door_handle_side]&.to_s&.upcase
                               end,
      'hinge_holes_marked' => opts[:doors] != :none
    )
  end


  # One continuous floor frame supports every box in a straight run. Its front
  # rail is recessed exactly two inches, like the fabricated kitchen base; the
  # cabinet box frames begin one profile-height above it. Longitudinal rails
  # remain one physical bar until the aluminum stock length is reached.
  def self.build_aluminum_foot_frame(parent_ents, opts, mats)
    width = opts[:width] || 600.mm
    depth = opts[:depth] || 600.mm
    ox = opts[:x] || 0
    oy = opts[:y] || 0
    oz = opts[:z] || 0
    max_span = opts[:max_span] || 1200.mm
    front_inset = opts[:front_inset] || 2.inch
    unit_boundaries = (opts[:unit_boundaries] || []).compact.select { |p| p.is_a?(Numeric) && p > 0 && p < width }.uniq.sort
    raise ArgumentError, 'Foot-frame width is too small' unless width > 2 * PROFILE_WIDTH
    unless depth > front_inset + 2 * PROFILE_WIDTH
      raise ArgumentError, 'Foot-frame depth is too small for the 2-inch inset'
    end
    raise ArgumentError, 'Foot-frame maximum span must be positive' unless max_span > 0

    frame = parent_ents.add_group
    sub = frame.entities
    pw = PROFILE_WIDTH
    ph = PROFILE_HEIGHT
    wall = PROFILE_WALL
    front_y = -depth + front_inset

    rail_breaks = [0]
    cursor = 0
    while width - cursor > ALUMINUM_STOCK_LENGTH
      candidates = unit_boundaries.select do |position|
        position > cursor && position <= cursor + ALUMINUM_STOCK_LENGTH
      end
      split = candidates.max
      split ||= cursor + ALUMINUM_STOCK_LENGTH
      rail_breaks << split
      cursor = split
    end
    rail_breaks << width
    rail_breaks.each_cons(2).with_index do |(start_x, end_x), index|
      segment_count = rail_breaks.length - 1
      suffix = segment_count > 1 ? "_Segment_#{index + 1}_Of_#{segment_count}" : ''
      create_box_bar(
        sub, end_x - start_x, pw, ph, wall,
        start_x, front_y, 0, 'X', mats[:alu],
        "Foot_Frame_Front_Rail#{suffix}"
      )
      create_box_bar(
        sub, end_x - start_x, pw, ph, wall,
        start_x, -pw, 0, 'X', mats[:alu],
        "Foot_Frame_Back_Rail#{suffix}"
      )
    end

    cross_centres = [pw / 2.0, width - pw / 2.0]
    anchors = [0] + unit_boundaries + [width]
    anchors.each_cons(2) do |left_edge, right_edge|
      interval = right_edge - left_edge
      bay_count = [(interval / max_span).ceil, 1].max
      (1...bay_count).each do |index|
        cross_centres << left_edge + interval * index / bay_count.to_f
      end
    end
    cross_centres.concat(unit_boundaries)
    cross_positions = cross_centres.map { |centre| centre - pw / 2.0 }
                                    .map { |position| [[position, 0].max, width - pw].min }
                                    .uniq.sort
    cross_positions.each_with_index do |position, index|
      role = if index.zero?
               'Foot_Frame_Left_End_Cross'
             elsif index == cross_positions.length - 1
               'Foot_Frame_Right_End_Cross'
             else
               "Foot_Frame_Intermediate_Cross_#{index}"
             end
      create_box_bar(
        sub, depth - front_inset - 2 * pw, pw, ph, wall,
        position, front_y + pw, 0, 'Y', mats[:alu], role
      )
    end

    # Front corner returns extending under the front vertical upright posts to prevent floating joints
    create_box_bar(
      sub, front_inset, pw, ph, wall,
      0, -depth, 0, 'Y', mats[:alu], 'Foot_Frame_Left_Corner_Return'
    )
    if width > pw
      create_box_bar(
        sub, front_inset, pw, ph, wall,
        width - pw, -depth, 0, 'Y', mats[:alu], 'Foot_Frame_Right_Corner_Return'
      )
    end

    if rail_breaks.length == 2
      validate_required_frame_parts!(
        frame,
        %w[Foot_Frame_Front_Rail Foot_Frame_Back_Rail],
        'continuous inset aluminum floor frame'
      )
    end

    frame.transform!(Geom::Transformation.translation([ox, oy, oz]))
    tag_part(
      frame, "Aluminum_Boxbar_Foot_Frame_#{width.to_mm.round}",
      'base_support' => 'ALUMINUM_BOXBAR_FOOT_FRAME',
      'width_mm' => width.to_mm,
      'depth_mm' => depth.to_mm,
      'height_mm' => ph.to_mm,
      'origin_x_mm' => (ox.respond_to?(:to_mm) ? ox.to_mm : ox.to_f),
      'origin_y_mm' => (oy.respond_to?(:to_mm) ? oy.to_mm : oy.to_f),
      'origin_z_mm' => (oz.respond_to?(:to_mm) ? oz.to_mm : oz.to_f),
      'front_rail_y_mm' => (oy + front_y).to_mm,
      'front_setback_mm' => front_inset.to_mm,
      'longitudinal_rail_segment_count' => rail_breaks.length - 1,
      'longitudinal_bars_continuous_to_stock_length' => true,
      'stock_length_mm' => ALUMINUM_STOCK_LENGTH.to_mm,
      'unit_boundaries_mm' => unit_boundaries.map { |value| value.to_mm }.join(','),
      'intermediate_cross_count' => [cross_positions.length - 2, 0].max,
      'cabinet_box_sits_on_top' => true,
      'requires_plinth_cover' => false
    )
  end

  # Editable aluminum handle profile. The authentic hollow sash and its 45Ãƒâ€šÃ‚Â°
  # ends remain unchanged. The thin inverted-L rises above the sash and turns
  # backward over the complete sash depth. Each adjoining drawer body is
  # shortened by this rise; the profile fills that pitch and the faces retain
  # only their normal 3 mm reveal.
  def self.create_finger_handle_top_bar(entities, length, material,
                                        profile_opts = {})
    projection = profile_opts[:handle_projection] || FINGER_HANDLE_EXTENSION
    rise = profile_opts[:handle_rise] || profile_opts[:handle_drop] ||
           FINGER_HANDLE_LIP_HEIGHT
    handle_wall = profile_opts[:handle_wall] || FINGER_HANDLE_WALL
    unless projection > 0 && rise > handle_wall && handle_wall > 0
      raise ArgumentError, 'Finger handle dimensions are invalid'
    end

    group = entities.add_group
    outer_sash = [
      [21.2.mm, 45.mm],
      [5.mm, 45.mm],
      [5.mm, 1.5.mm],
      [1.5.mm, 1.5.mm],
      [1.5.mm, 8.5.mm],
      [3.5.mm, 8.5.mm],
      [3.5.mm, 10.mm],
      [0.mm, 10.mm],
      [0.mm, 0.mm],
      [21.2.mm, 0.mm]
    ].reverse

    outer_handle = [
      [21.2.mm, 0.mm],
      [21.2.mm - handle_wall, 0.mm],
      [21.2.mm - handle_wall, -rise + handle_wall],
      [handle_wall, -rise + handle_wall],
      [handle_wall, -rise + 10.mm],
      [0.mm, -rise + 10.mm],
      [0.mm, -rise],
      [21.2.mm, -rise]
    ].reverse

    inner = [
      [6.5.mm, 1.5.mm], [19.7.mm, 1.5.mm],
      [19.7.mm, 43.5.mm], [6.5.mm, 43.5.mm]
    ].reverse

    start_sash = outer_sash.map { |yy, zz| Geom::Point3d.new(zz, yy, zz) }
    end_sash = outer_sash.map { |yy, zz| Geom::Point3d.new(length - zz, yy, zz) }

    start_inner = inner.map { |yy, zz| Geom::Point3d.new(zz, yy, zz) }
    end_inner = inner.map { |yy, zz| Geom::Point3d.new(length - zz, yy, zz) }

    start_handle = outer_handle.map { |yy, zz| Geom::Point3d.new(0, yy, zz) }
    end_handle = outer_handle.map { |yy, zz| Geom::Point3d.new(length, yy, zz) }

    start_face_sash = group.entities.add_face(start_sash)
    start_hole = group.entities.add_face(start_inner)
    start_hole.erase! if start_hole && start_hole.valid?
    end_face_sash = group.entities.add_face(end_sash)
    end_hole = group.entities.add_face(end_inner)
    end_hole.erase! if end_hole && end_hole.valid?
    raise 'Could not create 45-degree finger profile ends' unless start_face_sash && end_face_sash

    begin
      start_face_handle = group.entities.add_face(start_handle)
    rescue ArgumentError
      start_handle.each_with_index do |pt, i|
        group.entities.add_line(pt, start_handle[(i + 1) % start_handle.length])
      end
    end
    
    begin
      end_face_handle = group.entities.add_face(end_handle)
    rescue ArgumentError
      end_handle.each_with_index do |pt, i|
        group.entities.add_line(pt, end_handle[(i + 1) % end_handle.length])
      end
    end

    outer_sash.length.times do |index|
      nxt = (index + 1) % outer_sash.length
      group.entities.add_face(
        start_sash[index], start_sash[nxt],
        end_sash[nxt], end_sash[index]
      )
    end

    outer_handle.length.times do |index|
      nxt = (index + 1) % outer_handle.length
      group.entities.add_face(
        start_handle[index], start_handle[nxt],
        end_handle[nxt], end_handle[index]
      )
    end

    inner.length.times do |index|
      nxt = (index + 1) % inner.length
      group.entities.add_face(
        start_inner[index], end_inner[index],
        end_inner[nxt], start_inner[nxt]
      )
    end

    group.entities.grep(Sketchup::Edge).each { |e| e.find_faces }

    # The handle is now fully integrated into the outer profile,
    # so it gets mitered and extruded automatically as one unit.
    group.material = material
    tag_part(
      group, "Integrated_Finger_Handle_Top_Bar_#{length.to_mm.round}",
      'profile_type' => '45MM_SASH_WITH_L_HANDLE',
      'length_mm' => length.to_mm,
      'body_depth_mm' => FINGER_FRAME_DEPTH.to_mm,
      'frame_face_mm' => FINGER_FRAME_FACE.to_mm,
      'handle_extension_mm' => projection.to_mm,
      'handle_lip_height_mm' => rise.to_mm,
      'handle_wall_mm' => handle_wall.to_mm,
      'handle_total_depth_mm' => FINGER_FRAME_DEPTH.to_mm,
      'lip_shape' => 'INVERTED_L_EXTENSION_ON_STANDARD_LIPPED_SASH',
      'lip_position' => 'BACKWARD_CAP_WITH_VISIBLE_UP_RISE',
      'projects_into_cabinet_mm' => projection.to_mm,
      'up_rise_mm' => rise.to_mm,
      'profile_is_parametric' => true,
      'body_join_type' => '45_DEGREE_MITER_BOTH_ENDS',
      'handle_end_type' => 'SQUARE_FULL_NOMINAL_WIDTH',
      'nominal_full_door_width' => true,
      'replaces_standard_top_sash_bar' => true,
      'source_reference' => 'Aluminum/src/sash_door.js',
      'nesting_type' => '1D_BAR',
      'stock_length_mm' => 3000
    )
  end

  def self.build_finger_pull_sash(entities, width, height, x, y, z,
                                  mats, name, handle_profile = {})
    assembly = entities.add_group
    sub = assembly.entities
    body_height = height
    raise ArgumentError, 'Finger sash is too narrow' unless width > 2 * FINGER_FRAME_FACE
    unless body_height > 2 * FINGER_FRAME_FACE
      raise ArgumentError, 'Finger sash is too short for its raised handle'
    end
    origin = Geom::Transformation.translation([x, y, z])

    sash_mat = mats[:sash_alu] || mats[:alu]
    infill_mat = mats[:door_acp] || mats[:acp]

    bottom = CBXHybridEngine.create_sash_bar(
      sub, width, sash_mat, mats[:hole], false
    )
    bottom.transform!(origin)
    tag_part(bottom, 'Finger_Sash_Bottom_45_Miter')

    top = create_finger_handle_top_bar(
      sub, width, sash_mat, handle_profile
    )
    top.transform!(Geom::Transformation.scaling(1, 1, -1))
    top.transform!(Geom::Transformation.translation([0, 0, body_height]))
    top.transform!(origin)

    left = CBXHybridEngine.create_sash_bar(
      sub, body_height, sash_mat, mats[:hole], false
    )
    left.transform!(
      Geom::Transformation.rotation([0, 0, 0], [0, 1, 0], -90.degrees)
    )
    left.transform!(Geom::Transformation.scaling(-1, 1, 1))
    left.transform!(origin)
    tag_part(left, 'Finger_Sash_Left_45_Miter')

    right = CBXHybridEngine.create_sash_bar(
      sub, body_height, sash_mat, mats[:hole], false
    )
    right.transform!(
      Geom::Transformation.rotation([0, 0, 0], [0, 1, 0], -90.degrees)
    )
    right.transform!(Geom::Transformation.translation([width, 0, 0]))
    right.transform!(origin)
    tag_part(right, 'Finger_Sash_Right_45_Miter')

    pane = create_solid_box(sub, 'ACP Door Infill', x + 10.mm, y + 1.75.mm,
               z + 10.mm, width - 20.mm,
               CBXHybridEngine::CLADDING_THICKNESS,
               body_height - 20.mm, infill_mat)
    pane.set_attribute('CBX', 'sheet_material', 'ACP')
    tag_part(
      assembly, name,
      'door_system' => 'ALUMINUM_SASH_FINGER_PULL',
      'gola_cut_required' => false,
      'integrated_lip_top_bar' => true,
      'sash_body_corner_joints' => '45_DEGREE_MITER',
      'handle_cap_ends' => 'SQUARE_FULL_WIDTH',
      'handle_bar_length_mm' => width.to_mm,
      'width_mm' => width.to_mm,
      'height_mm' => height.to_mm,
      'overall_envelope_height_mm' =>
        (height + (handle_profile[:handle_rise] ||
                   handle_profile[:handle_drop] ||
                   FINGER_HANDLE_LIP_HEIGHT)).to_mm,
      'sash_body_height_mm' => body_height.to_mm,
      'handle_rise_mm' =>
        (handle_profile[:handle_rise] || handle_profile[:handle_drop] ||
         FINGER_HANDLE_LIP_HEIGHT).to_mm,
      'face_reveal_above_mm' => DOOR_GAP.to_mm,
      'required_clearance_above_mm' => DOOR_GAP.to_mm,
      'drawer_body_reduced_for_handle_rise' => true,
      'handle_projection_mm' =>
        (handle_profile[:handle_projection] ||
         FINGER_HANDLE_EXTENSION).to_mm,
      'handle_rise_mm_editable' =>
        (handle_profile[:handle_rise] || handle_profile[:handle_drop] ||
         FINGER_HANDLE_LIP_HEIGHT).to_mm,
      'handle_profile_editable' => true
    )
  end

  def self.remove_top_cladding(frame)
    top = frame.entities.grep(Sketchup::Group).find do |group|
      group.name == 'Clad_Top'
    end
    top.erase! if top && top.valid?
  end

  def self.build_aluminum_base(entities, opts, mats)
    width = opts[:width] || 600.mm
    height = opts[:height] || 870.mm
    depth = opts[:depth] || 600.mm
    support_height = opts[:support_height] || PROFILE_HEIGHT
    external_floor_frame = opts[:external_floor_frame] == true
    x = opts[:x] || 0
    y = opts[:y] || 0
    z = opts[:z] || 0
    drawer_count = opts[:drawer_count].to_i
    blind_width = opts[:blind_width]
    blind_side = opts[:blind_side] || :right
    handle_profile = opts[:handle_profile] || {}
    handle_rise = handle_profile[:handle_rise] ||
                  handle_profile[:handle_drop] || FINGER_HANDLE_LIP_HEIGHT
    handle_projection = handle_profile[:handle_projection] ||
                        FINGER_HANDLE_EXTENSION

    assembly = entities.add_group
    sub = assembly.entities
    body_height = height - support_height
    unless external_floor_frame
      build_aluminum_foot_frame(
        sub, { width: width, depth: depth }, mats
      )
    end
    division_positions = nil
    if blind_width
      opening_width = width - blind_width
      divider_center = blind_side == :right ? opening_width : blind_width
      division_positions = [divider_center - CBXHybridEngine::SASH_THICKNESS]
    end
    frame = CBXHybridEngine.build_aluminum_top_cabinet(
      sub,
      {
        width: width, height: body_height, depth: depth,
        x: 0, y: 0, z: support_height,
        max_bay_width: 600.mm,
        division_positions: division_positions,
        has_left_sash: true, has_right_sash: true,
        end_sash_panel: :acp,
        left_end_panel: (opts[:left_end_panel] || :acp),
        right_end_panel: (opts[:right_end_panel] || :acp),
        doors: :none,
        assembly_role: 'Aluminum_Base_Structural_Frame'
      },
      mats
    )
    remove_top_cladding(frame)
    validate_required_frame_parts!(
      frame, %w[Bottom_Front_Rail Bottom_Back_Rail],
      'aluminum cabinet box frame above floor support'
    )

    front_y = -depth - CBXHybridEngine::SASH_THICKNESS
    gap = DOOR_GAP
    front_bottom = support_height + gap
    front_top = height - gap
    front_pitch = front_top - front_bottom
    single_body_height = front_pitch - handle_rise
    if blind_width
      opening_width = width - blind_width
      door_x = blind_side == :right ? 0 : blind_width
      blind_x = blind_side == :right ? opening_width : 0
      # Working Door Leaf with finger-pull handle
      build_finger_pull_sash(
        sub, opening_width - DOOR_GAP, single_body_height,
        door_x, front_y, front_bottom,
        mats, 'Aluminum_Corner_Working_Finger_Door', handle_profile
      )
      # Blind side fixed panel: Non-handled clean flat aluminum/ACP panel flush with front
      blind_panel_w = blind_width - DOOR_GAP
      blind_panel_h = front_pitch
      fixed = create_solid_box(
        sub, 'Aluminum_Corner_Fixed_Blind_Panel',
        blind_x + DOOR_GAP / 2.0, front_y + CBXHybridEngine::SASH_THICKNESS - CLADDING_THICKNESS, front_bottom,
        blind_panel_w, CLADDING_THICKNESS, blind_panel_h,
        mats[:acp] || mats[:alu]
      )
      fixed.set_attribute('CBX', 'fixed_blind_panel', true)

      # Internal Shelf Support Cross Beam (Box-Bar running Y-depth at mid-height)
      shelf_mid_z = front_bottom + front_pitch / 2.0
      divider_x = blind_side == :right ? opening_width : blind_width
      CBXHybridEngine.create_box_bar(
        sub, depth - 2 * PROFILE_WIDTH, PROFILE_WIDTH, PROFILE_HEIGHT, PROFILE_WALL,
        divider_x - PROFILE_WIDTH / 2.0, -depth + PROFILE_WIDTH, shelf_mid_z - PROFILE_HEIGHT / 2.0,
        'Y', mats[:boxbar] || mats[:alu], 'Blind_Corner_Shelf_Support_Cross_Beam'
      )
    elsif drawer_count > 0
      available = front_pitch - gap * (drawer_count - 1)
      leaf_pitch = available / drawer_count.to_f
      leaf_height = leaf_pitch - handle_rise
      unless leaf_height > 2 * FINGER_FRAME_FACE
        raise ArgumentError, 'Drawer pitch is too short for the raised handle'
      end
      drawer_count.times do |index|
        build_finger_pull_sash(
          sub, width, leaf_height, 0, front_y,
          front_bottom + index * (leaf_pitch + gap),
          mats, "Aluminum_Finger_Drawer_Front_#{index + 1}",
          handle_profile
        )
      end
    else
      leaf_count = [(width / MAX_BOTTOM_DOOR_WIDTH).ceil, 1].max
      leaf_width = (width - gap * (leaf_count - 1)) / leaf_count.to_f
      leaf_count.times do |index|
        build_finger_pull_sash(
          sub, leaf_width, single_body_height,
          index * (leaf_width + gap), front_y, front_bottom,
          mats, "Aluminum_Base_Finger_Pull_Door_#{index + 1}",
          handle_profile
        )
      end
    end

    assembly.transform!(Geom::Transformation.translation([x, y, z]))
    role = blind_width ? 'Aluminum_Blind_Corner' : 'Aluminum_Base'
    tag_part(
      assembly, "#{role}_#{width.to_mm.round}",
      'cabinet_type' => role.upcase,
      'width_mm' => width.to_mm,
      'height_mm' => height.to_mm,
      'depth_mm' => depth.to_mm,
      'overall_depth_with_door_mm' =>
        (depth + CBXHybridEngine::SASH_THICKNESS).to_mm,
      'front_system' => '45MM_SASH_L_HANDLE_FINGER_PULL',
      'gola_cut_required' => false,
      'blind_width_mm' => blind_width&.to_mm,
      'blind_side' => (blind_width ? blind_side.to_s : nil),
      'corner_reference' => (blind_width ? 'CNT-4004_ONE_SIDED_BLIND' : nil),
      'requires_plinth_cover' => false,
      'separate_plinth_frame' => false,
      'bottom_boxbar_is_base' => false,
      'floor_frame_system' => if external_floor_frame
                                'SHARED_EXTERNAL_2IN_INSET_LONG_FRAME'
                              else
                                'INTEGRATED_2IN_INSET_FRAME'
                              end,
      'floor_frame_front_inset_mm' => 2.inch.to_mm,
      'cabinet_box_frame_z_mm' => support_height.to_mm,
      'bottom_frame_visible_below_fronts' => true,
      'front_bottom_above_frame_mm' => front_bottom.to_mm,
      'raised_handle_top_mm' => front_top.to_mm,
      'drawer_face_reveal_mm' => gap.to_mm,
      'maximum_single_door_leaf_mm' => MAX_BOTTOM_DOOR_WIDTH.to_mm,
      'left_end_panel' => (opts[:left_end_panel] || :acp).to_s.upcase,
      'right_end_panel' => (opts[:right_end_panel] || :acp).to_s.upcase,
      'origin_x_mm' => x.to_mm,
      'origin_y_mm' => y.to_mm,
      'origin_z_mm' => z.to_mm,
      'plinth_height_mm' => support_height.to_mm
    )
  end

  def self.omit_frame_side_and_back_skins(frame,
                                          keep_exposed_end_skins: false)
    backs = frame.entities.grep(Sketchup::Group).select do |group|
      group.name.start_with?('Clad_Back')
    end
    backs.each { |back| back.erase! if back.valid? }

    unless keep_exposed_end_skins
      %w[Left_Sash_End Right_Sash_End].each do |end_name|
        sash_end = frame.entities.grep(Sketchup::Group).find do |group|
          group.name == end_name
        end
        next unless sash_end

        pane = sash_end.entities.grep(Sketchup::Group).find do |group|
          group.name == 'Infill_Pane'
        end
        pane.erase! if pane && pane.valid?
        sash_end.set_attribute('CBX', 'infill_omitted_for_economy', true)
      end
    end
    frame.set_attribute(
      'CBX', 'side_skins_present', keep_exposed_end_skins
    )
    frame.set_attribute('CBX', 'back_skin_present', false)
    frame.set_attribute(
      'CBX', 'economy_exposed_end_skins_retained',
      keep_exposed_end_skins
    )
  end

  # Adjacent aluminum base units share one complete structural frame. Cabinet
  # boundaries create only structural nodes/front divisions; longitudinal bars
  # stay continuous until the 6000 mm stock length is reached.
  def self.build_aluminum_continuous_base_run(entities, opts, mats)
    units = opts[:units] || []
    raise ArgumentError, 'Continuous aluminum base run needs units' if units.empty?

    width = units.sum { |unit| unit[:width] }
    height = opts[:height] || 870.mm
    depth = opts[:depth] || 600.mm
    x = opts[:x] || 0
    y = opts[:y] || 0
    z = opts[:z] || 0
    economy = opts[:economy] == true
    external_floor_frame = opts[:external_floor_frame] == true

    # Specialized architectural filler handling: if run is narrower than standard carcase or filler-only
    if width < 120.mm || units.all? { |u| u[:front] == :filler }
      assembly = entities.add_group
      assembly.name = "Aluminum_Base_Filler_#{width.to_mm.round}mm"
      sub = assembly.entities
      gap = DOOR_GAP
      front_bottom = PROFILE_HEIGHT + gap
      front_top = height - gap
      front_pitch = front_top - front_bottom
      front_y = -depth - CBXHybridEngine::SASH_THICKNESS
      filler_panel_w = [width - gap, 10.mm].max
      filler_panel_h = front_pitch

      # Flush ACP or Aluminum Filler Face
      panel = create_solid_box(
        sub, "Continuous_Base_Filler_Panel",
        gap / 2.0, front_y + CBXHybridEngine::SASH_THICKNESS - CLADDING_THICKNESS, front_bottom,
        filler_panel_w, CLADDING_THICKNESS, filler_panel_h,
        mats[:acp] || mats[:alu]
      )
      panel.set_attribute('CBX', 'is_filler_panel', true)

      # Aluminum Box-Bar Top Cleat & Wall Support
      if width >= PROFILE_WIDTH
        CBXHybridEngine.create_box_bar(
          sub, width, PROFILE_WIDTH, PROFILE_HEIGHT, PROFILE_WALL,
          0, -depth + PROFILE_WIDTH, height - PROFILE_HEIGHT,
          'X', mats[:boxbar] || mats[:alu], "Filler_Top_Mounting_Rail"
        )
        CBXHybridEngine.create_box_bar(
          sub, PROFILE_WIDTH, PROFILE_WIDTH, height - PROFILE_HEIGHT, PROFILE_WALL,
          width / 2.0 - PROFILE_WIDTH / 2.0, -depth + PROFILE_WIDTH, PROFILE_HEIGHT,
          'Z', mats[:boxbar] || mats[:alu], "Filler_Support_Post"
        )
      end

      assembly.transformation = Geom::Transformation.translation(Geom::Vector3d.new(x, y, z))
      return assembly
    end

    handle_profile = opts[:handle_profile] || {}
    handle_rise = handle_profile[:handle_rise] ||
                  handle_profile[:handle_drop] || FINGER_HANDLE_LIP_HEIGHT
    handle_projection = handle_profile[:handle_projection] ||
                        FINGER_HANDLE_EXTENSION
    blind_width_for = lambda do |unit|
      value = unit[:blind_width] || depth + 25.mm
      unless value > 0 && value < unit[:width]
        raise ArgumentError, 'Blind return must be inside its cabinet width'
      end
      value
    end
    boundaries = []
    cursor = 0.mm
    units.each_with_index do |unit, index|
      unit_width = unit[:width]
      if unit[:front] == :blind
        blind_width = blind_width_for.call(unit)
        opening_width = unit_width - blind_width
        divider = unit[:blind_side] == :left ? blind_width : opening_width
        boundaries << cursor + divider
      elsif unit[:width] > 1200.mm
        # Wide spans > 1200mm require intermediate structural posts
        div_count = (unit_width / 1200.mm).ceil
        (1...div_count).each do |d_idx|
          boundaries << cursor + (unit_width * d_idx / div_count.to_f)
        end
      end
      cursor += unit_width
      boundaries << cursor if index < units.length - 1
    end
    boundaries = boundaries.compact.uniq.sort
    division_positions = boundaries.map do |boundary|
      boundary - CBXHybridEngine::SASH_THICKNESS
    end

    assembly = entities.add_group
    sub = assembly.entities
    unless external_floor_frame
      build_aluminum_foot_frame(
        sub,
        {
          width: width, depth: depth,
          unit_boundaries: boundaries
        },
        mats
      )
    end
    has_left = (opts[:left_end_panel] != :none)
    has_right = (opts[:right_end_panel] != :none)
    frame = CBXHybridEngine.build_aluminum_top_cabinet(
      sub,
      {
        width: width, height: height - PROFILE_HEIGHT, depth: depth,
        x: 0, y: 0, z: PROFILE_HEIGHT,
        division_positions: division_positions,
        has_left_sash: has_left, has_right_sash: has_right,
        end_sash_panel: :acp,
        left_end_panel: (opts[:left_end_panel] || :acp),
        right_end_panel: (opts[:right_end_panel] || :acp),
        doors: :none,
        assembly_role: 'Aluminum_Continuous_Base_Structural_Frame'
      },
      mats
    )
    remove_top_cladding(frame)
    omit_frame_side_and_back_skins(frame) if economy

    validate_required_frame_parts!(
      frame, %w[Bottom_Front_Rail Bottom_Back_Rail],
      'continuous aluminum cabinet box frame above floor support'
    )
    gap = DOOR_GAP
    front_bottom = PROFILE_HEIGHT + gap
    front_top = height - gap
    front_pitch = front_top - front_bottom
    single_body_height = front_pitch - handle_rise
    front_y = -depth - CBXHybridEngine::SASH_THICKNESS
    cursor = 0.mm
    units.each_with_index do |unit, index|
      unit_width = unit[:width]
      front_x0 = cursor + (index.zero? ? 0 : gap / 2.0)
      front_x1 = cursor + unit_width -
                 (index == units.length - 1 ? 0 : gap / 2.0)
      case unit[:front]
      when :drawers
        count = [unit[:drawer_count].to_i, 1].max
        available = front_pitch - gap * (count - 1)
        leaf_pitch = available / count.to_f
        leaf_height = leaf_pitch - handle_rise
        unless leaf_height > 2 * FINGER_FRAME_FACE
          raise ArgumentError, 'Drawer pitch is too short for the raised handle'
        end
        count.times do |drawer_index|
          build_finger_pull_sash(
            sub, front_x1 - front_x0, leaf_height,
            front_x0, front_y,
            front_bottom + drawer_index * (leaf_pitch + gap),
            mats, "Continuous_Base_Drawer_#{index + 1}_#{drawer_index + 1}",
            handle_profile
          )
        end
      when :blind
        blind_width = blind_width_for.call(unit)
        opening_width = unit_width - blind_width
        blind_side = unit[:blind_side] || :right
        if blind_side == :right
          working_x = cursor
          fixed_x = cursor + opening_width
        else
          fixed_x = cursor
          working_x = cursor + blind_width
        end
        
        # If opening is > 600mm, divide into 2 balanced door leaves closing to each other
        door_leaves = (opening_width > 600.mm) ? 2 : 1
        leaf_width = (opening_width - gap * (door_leaves + 1)) / door_leaves.to_f
        door_leaves.times do |d_idx|
          build_finger_pull_sash(
            sub, leaf_width, single_body_height,
            working_x + gap + d_idx * (leaf_width + gap), front_y, front_bottom,
            mats, "Continuous_Base_Blind_Working_Door_#{index + 1}_Leaf_#{d_idx + 1}",
            handle_profile
          )
        end

        # Blind side fixed panel: Non-handled clean flat aluminum/ACP panel flush with front
        blind_panel_w = blind_width - gap
        blind_panel_h = front_pitch
        fixed = create_solid_box(
          sub, "Continuous_Base_Blind_Fixed_Panel_#{index + 1}",
          fixed_x + gap / 2.0, front_y + CBXHybridEngine::SASH_THICKNESS - CLADDING_THICKNESS, front_bottom,
          blind_panel_w, CLADDING_THICKNESS, blind_panel_h,
          mats[:acp] || mats[:alu]
        )
        fixed.set_attribute('CBX', 'fixed_blind_panel', true)

        # Internal Shelf Support Cross Beam (Box-Bar running Y-depth at mid-height)
        shelf_mid_z = front_bottom + front_pitch / 2.0
        divider_x = blind_side == :right ? (cursor + opening_width) : (cursor + blind_width)
        CBXHybridEngine.create_box_bar(
          sub, depth - 2 * PROFILE_WIDTH, PROFILE_WIDTH, PROFILE_HEIGHT, PROFILE_WALL,
          divider_x - PROFILE_WIDTH / 2.0, -depth + PROFILE_WIDTH, shelf_mid_z - PROFILE_HEIGHT / 2.0,
          'Y', mats[:boxbar] || mats[:alu], "Blind_Corner_Shelf_Support_Cross_Beam_#{index + 1}"
        )
      when :filler
        # Architectural Filler / Gap Trim Panel (Flush solid fascia without door handles)
        filler_panel_w = unit_width - gap
        filler_panel_h = front_pitch
        create_solid_box(
          sub, "Continuous_Base_Filler_Panel_#{index + 1}",
          cursor + gap / 2.0, front_y + CBXHybridEngine::SASH_THICKNESS - CLADDING_THICKNESS, front_bottom,
          filler_panel_w, CLADDING_THICKNESS, filler_panel_h,
          mats[:acp] || mats[:alu]
        )
      else
        sub_comp_count = (unit_width > 1200.mm) ? (unit_width / 1200.mm).ceil : 1
        sub_comp_width = unit_width / sub_comp_count.to_f

        sub_comp_count.times do |sub_idx|
          sub_x_start = cursor + sub_idx * sub_comp_width
          sub_x_end = sub_x_start + sub_comp_width

          is_first = (index.zero? && sub_idx.zero?)
          is_last = (index == units.length - 1 && sub_idx == sub_comp_count - 1)

          dx0 = sub_x_start + (is_first ? 0 : gap / 2.0)
          dx1 = sub_x_end - (is_last ? 0 : gap / 2.0)
          d_span = dx1 - dx0

          # Max base door leaf width is 600mm. Each compartment > 600mm gets 2 doors closing to center.
          leaves = (sub_comp_width > 600.mm) ? 2 : 1
          lw = (d_span - gap * (leaves - 1)) / leaves.to_f

          leaves.times do |l_idx|
            build_finger_pull_sash(
              sub, lw, single_body_height,
              dx0 + l_idx * (lw + gap),
              front_y, front_bottom,
              mats,
              "Continuous_Base_Door_#{index + 1}_Sub_#{sub_idx + 1}_Leaf_#{l_idx + 1}",
              handle_profile
            )
          end
        end
      end
      cursor += unit_width
    end

    assembly.transform!(Geom::Transformation.translation([x, y, z]))
    tag_part(
      assembly, "Aluminum_Continuous_Base_Run_#{width.to_mm.round}",
      'cabinet_type' => 'ALUMINUM_CONTINUOUS_BASE_RUN',
      'width_mm' => width.to_mm,
      'height_mm' => height.to_mm,
      'depth_mm' => depth.to_mm,
      'overall_depth_with_door_mm' =>
        (depth + CBXHybridEngine::SASH_THICKNESS).to_mm,
      'origin_x_mm' => x.to_mm,
      'origin_y_mm' => y.to_mm,
      'origin_z_mm' => z.to_mm,
      'requires_plinth_cover' => false,
      'floor_frame_system' => if external_floor_frame
                                'SHARED_EXTERNAL_2IN_INSET_LONG_FRAME'
                              else
                                'INTEGRATED_2IN_INSET_LONG_FRAME'
                              end,
      'floor_frame_front_inset_mm' => 2.inch.to_mm,
      'cabinet_box_frame_z_mm' => PROFILE_HEIGHT.to_mm,
      'unit_count' => units.length,
      'continuous_longitudinal_bars' => true,
      'stock_length_mm' => ALUMINUM_STOCK_LENGTH.to_mm,
      'stock_split_required' => width > ALUMINUM_STOCK_LENGTH,
      'bottom_frame_visible_below_fronts' => true,
      'front_bottom_above_frame_mm' => front_bottom.to_mm,
      'raised_handle_top_mm' => front_top.to_mm,
      'drawer_face_reveal_mm' => gap.to_mm,
      'maximum_single_door_leaf_mm' => DEFAULT_MAX_BAY_WIDTH.to_mm,
      'economy_frame_only' => economy,
      'side_skins_present' => !economy,
      'back_skin_present' => !economy,
      'left_end_panel' => (opts[:left_end_panel] || :acp).to_s.upcase,
      'right_end_panel' => (opts[:right_end_panel] || :acp).to_s.upcase
    )
  end

  # Recess a complete 600 mm hood bay inside one continuous aluminum frame.
  # Both lower longitudinal rails and the bottom ACP rise 6 inches only in the
  # hood bay. Existing bay-boundary front/back uprights remain continuous and
  # receive added raised front-to-back supports. There is no 9x6 duct cut.
  def self.apply_aluminum_hood_recess(cabinet, width, height, depth,
                                      bay_widths, hood_bay, mats)
    sub = cabinet.entities
    pw = CBXHybridEngine::PROFILE_WIDTH
    ph = CBXHybridEngine::PROFILE_HEIGHT
    wall = CBXHybridEngine::PROFILE_WALL
    has_left_sash = cabinet.get_attribute('CBX', 'has_left_sash') == true
    has_right_sash = cabinet.get_attribute('CBX', 'has_right_sash') == true
    rail_x0 = has_left_sash ? CBXHybridEngine::SASH_THICKNESS : 0.mm
    rail_x1 = width -
              (has_right_sash ? CBXHybridEngine::SASH_THICKNESS : 0.mm)
    # Allow flexible hood bay widths between 400mm and 1200mm without throwing fatal exceptions
    actual_hood_w = bay_widths[hood_bay - 1]
    if actual_hood_w < 350.mm || actual_hood_w > 1200.mm
      raise ArgumentError, "Hood bay width #{actual_hood_w.to_mm.round}mm is outside allowable range (350-1200mm)"
    end
    bay_boundaries = []
    cursor = 0.mm
    bay_widths.each do |bay_width|
      cursor += bay_width
      bay_boundaries << cursor
    end
    hood_x0 = bay_widths.first(hood_bay - 1).sum
    hood_x1 = hood_x0 + bay_widths[hood_bay - 1]
    raise ArgumentError, 'Hood bay is outside continuous frame' if hood_x0 >= hood_x1

    %w[Bottom_Front_Rail Bottom_Back_Rail Clad_Bottom Clad_Back].each do |name|
      group = sub.grep(Sketchup::Group).find { |item| item.name == name }
      group.erase! if group && group.valid?
    end

    rail_spans = [
      [rail_x0, hood_x0, 0, 'Left_Low'],
      [hood_x0, hood_x1, HOOD_CLEARANCE, 'Hood_Raised_6in'],
      [hood_x1, rail_x1, 0, 'Right_Low']
    ]
    rail_spans.each do |x0, x1, rail_z, role|
      next unless x1 > x0

      CBXHybridEngine.create_box_bar(
        sub, x1 - x0, pw, ph, wall,
        x0, -depth, rail_z, 'X', mats[:alu],
        "Bottom_Front_Rail_#{role}"
      )
      CBXHybridEngine.create_box_bar(
        sub, x1 - x0, pw, ph, wall,
        x0, -pw, rail_z, 'X', mats[:alu],
        "Bottom_Back_Rail_#{role}"
      )
    end

    node_xs = bay_boundaries[0...-1].map { |boundary| boundary - pw / 2.0 }
    node_xs << rail_x0 unless has_left_sash
    node_xs << rail_x1 - pw unless has_right_sash
    node_xs = node_xs.uniq.sort
    blocked_x = node_xs.map do |node_x|
      [node_x - CBXHybridEngine::CUTOUT_CLEARANCE,
       node_x + pw + CBXHybridEngine::CUTOUT_CLEARANCE]
    end
    panel_y = -depth + pw
    panel_depth = depth - 2 * pw
    notch_depth = ph - pw + CBXHybridEngine::CUTOUT_CLEARANCE
    panel_spans = [
      ['Clad_Bottom_Left_Low', rail_x0, hood_x0, ph],
      ['Clad_Bottom_Hood_Raised_6in', hood_x0, hood_x1,
       HOOD_CLEARANCE + ph],
      ['Clad_Bottom_Right_Low', hood_x1, rail_x1, ph]
    ]
    panel_spans.each do |name, x0, x1, panel_z|
      next unless x1 > x0

      CBXHybridEngine.create_notched_horizontal_panel(
        sub, name, x0, panel_y, panel_z,
        x1 - x0, panel_depth, CBXHybridEngine::CLADDING_THICKNESS,
        blocked_x, notch_depth, notch_depth, mats[:acp]
      )
    end

    # A slim hood bay is open to the wall; it receives no rear ACP. Each
    # surrounding rear sheet remains one notched manufacturing part.
    back_y = -pw - CBXHybridEngine::CLADDING_THICKNESS
    back_height = height - 2 * ph
    if hood_x0 > rail_x0
      left_back = CBXHybridEngine.create_back_cladding(
        sub, rail_x0, hood_x0, back_y, ph, back_height,
        blocked_x, mats[:acp]
      )
      tag_part(left_back, 'Clad_Back_Left_Of_Hood_Open_Bay')
    end
    if rail_x1 > hood_x1
      right_back = CBXHybridEngine.create_back_cladding(
        sub, hood_x1, rail_x1, back_y, ph, back_height,
        blocked_x, mats[:acp]
      )
      tag_part(right_back, 'Clad_Back_Right_Of_Hood_Open_Bay')
    end

    # Both hood boundaries already carry a paired front/back upright because
    # they are structural bay divisions. Add the elevated depth supports that
    # receive the raised hood rails and ACP shelf.
    hood_support_xs = [
      (!has_left_sash && (hood_x0 - rail_x0).abs <= 0.1.mm) ?
        rail_x0 : hood_x0 - pw / 2.0,
      (!has_right_sash && (hood_x1 - rail_x1).abs <= 0.1.mm) ?
        rail_x1 - pw : hood_x1 - pw / 2.0
    ]
    hood_support_xs.each_with_index do |node_x, index|
      # A structural end without a sash starts exactly at rail_x0 (or ends at
      # rail_x1-pw). Allow those valid end-bar origins as well as internal bay
      # centres, so a future hood in the first/last segment cannot lose one of
      # its raised front-to-back supports.
      next unless node_x >= rail_x0 && node_x <= rail_x1 - pw

      CBXHybridEngine.create_box_bar(
        sub, depth - 2 * pw, pw, ph, wall,
        node_x, -depth + pw, HOOD_CLEARANCE,
        'Y', mats[:alu], "Hood_Raised_Support_#{index + 1}"
      )
    end

    cabinet.set_attribute('CBX', 'hood_recess_type', 'RAISED_FRAME_BAY')
    cabinet.set_attribute('CBX', 'hood_recess_height_mm', HOOD_CLEARANCE.to_mm)
    cabinet.set_attribute(
      'CBX', 'hood_bay_width_mm', bay_widths[hood_bay - 1].to_mm
    )
    cabinet.set_attribute('CBX', 'hood_boundary_upright_pairs', 2)
    cabinet.set_attribute('CBX', 'hood_raised_depth_supports', 2)
    cabinet.set_attribute('CBX', 'hood_back_skin_present', false)
    cabinet.set_attribute('CBX', 'back_skin_mode', 'OMITTED_IN_HOOD_BAY')
  end

  # A real aluminum open unit is a separate doorless aluminum boxÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Ânot an MDF
  # rack painted to match. Its side sashes face inward, its ACP bottom/top and
  # shelf cover the support bars, and its own ACP back remains present even in
  # economy mode. The box depth includes the adjacent door thickness so its
  # open front frame lands on the same faÃƒÆ’Ã‚Â§ade plane as neighbouring doors.
  def self.build_aluminum_open_rack_box(entities, opts, mats)
    width = opts[:width]
    height = opts[:height]
    frame_depth = opts[:frame_depth]
    raise ArgumentError, 'Open rack width is required' unless width && width > 0
    raise ArgumentError, 'Open rack height is required' unless height && height > 0
    unless frame_depth && frame_depth > 0
      raise ArgumentError, 'Open rack frame depth is required'
    end

    x = opts[:x] || 0
    y = opts[:y] || 0
    z = opts[:z] || 0
    overall_depth = frame_depth + SASH_THICKNESS
    rack = entities.add_group
    sub = rack.entities
    box = build_aluminum_top_cabinet(
      sub,
      {
        width: width, height: height, depth: overall_depth,
        x: 0, y: 0, z: 0,
        has_left_sash: true, has_right_sash: true,
        inward_end_sash_faces: true,
        left_end_panel: :acp, right_end_panel: :acp,
        end_sash_panel: :acp,
        division_positions: [],
        doors: :none,
        alignment_class: nil,
        assembly_role: 'Doorless_Aluminum_Open_Box_Inward_Sash_Panels'
      },
      mats
    )
    box.set_attribute('CBX', 'sash_finished_faces_direction', 'INWARD')
    box.set_attribute('CBX', 'front_door_present', false)
    box.set_attribute('CBX', 'economy_back_omission_applies', false)

    rack.transform!(Geom::Transformation.translation([x, y, z]))
    tag_part(
      rack, "Aluminum_Doorless_Open_Box_#{width.to_mm.round}",
      'cabinet_type' => 'ALUMINUM_OPEN_BOX_SEPARATE_DOORLESS',
      'width_mm' => width.to_mm,
      'height_mm' => height.to_mm,
      'frame_depth_mm' => frame_depth.to_mm,
      'overall_depth_with_front_mm' => overall_depth.to_mm,
      'front_face_y_mm' => (y - overall_depth).to_mm,
      'bottom_flush_with_sides' => true,
      'interior_bottom_gap_present' => false,
      'interior_panels_cover_support_bars' => true,
      'own_back_present' => true,
      'covered_in_economy' => true,
      'separate_from_aluminum_frame' => true,
      'front_door_present' => false,
      'construction_material' => 'ALUMINUM_SASH_AND_ACP',
      'inverted_sash_panels_face_inward' => true,
      'mdf_open_rack_logic_used' => false
    )
  end

  # Bridge the 25 mm blind-return clearance at the horizontal storage levels.
  # The L remains internally openÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Âthere is deliberately no vertical separator
  # sheetÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Âbut loose items cannot fall into an unclosed slot at the junction.
  def self.build_aluminum_l_corner_tunnel(entities, opts, mats)
    corner_x = opts[:corner_x]
    blind_return = opts[:blind_return]
    main_depth = opts[:main_depth]
    height = opts[:height]
    raise ArgumentError, 'Corner tunnel X is required' unless corner_x
    unless blind_return && main_depth && blind_return > main_depth
      raise ArgumentError, 'Corner tunnel needs blind return > cabinet depth'
    end
    raise ArgumentError, 'Corner tunnel height is required' unless height

    z0 = opts[:z] || 0
    support_height = opts[:support_height] || 0.mm
    include_top = opts[:include_top] == true
    gap_depth = blind_return - main_depth
    x0 = corner_x - blind_return
    y0 = -blind_return
    box_height = height - support_height
    levels = [
      ['Bottom', z0 + support_height + PROFILE_HEIGHT],
      ['Shelf', z0 + support_height + box_height / 2.0 +
        PROFILE_HEIGHT / 2.0]
    ]
    if include_top
      levels << [
        'Top', z0 + height - PROFILE_HEIGHT - CLADDING_THICKNESS
      ]
    end

    tunnel = entities.add_group
    levels.each do |level_name, level_z|
      create_solid_box(
        tunnel.entities, "Corner_Tunnel_#{level_name}_Closure",
        x0, y0, level_z,
        blind_return, gap_depth, CLADDING_THICKNESS, mats[:acp]
      )
    end
    tag_part(
      tunnel, "Aluminum_L_Corner_Open_Tunnel_#{blind_return.to_mm.round}",
      'construction' => 'OPEN_L_TUNNEL_WITH_HORIZONTAL_CLOSURES',
      'blind_return_mm' => blind_return.to_mm,
      'cabinet_depth_mm' => main_depth.to_mm,
      'support_height_mm' => support_height.to_mm,
      'clearance_bridge_mm' => gap_depth.to_mm,
      'separator_sheet_present' => false,
      'fall_through_gaps_present' => false,
      'closure_level_count' => levels.length
    )
  end

  # Aluminum wall rails remain continuous within each uninterrupted framed
  # span. A requested open rack deliberately breaks the run and is installed
  # as the separate full-depth covered box above.
  def self.build_aluminum_continuous_wall_run(entities, opts, mats)
    requested_widths = opts[:bay_widths]
    if requested_widths && !requested_widths.empty?
      bay_widths = requested_widths
    else
      bay_count = opts[:bay_count] || 4
      bay_width = opts[:bay_width] || 600.mm
      bay_widths = Array.new(bay_count, bay_width)
    end
    bay_count = bay_widths.length
    width = bay_widths.sum
    height = opts[:height] || 610.mm
    depth = opts[:depth] || 350.mm
    hood_bay = opts.key?(:hood_bay) ? opts[:hood_bay] : 2
    open_bay = opts.key?(:open_bay) ? opts[:open_bay] : 3
    fixed_acp_bays = opts[:fixed_acp_bays] || []
    economy = opts[:economy] == true
    if open_bay && !open_bay.between?(1, bay_count)
      raise ArgumentError, 'Open-rack bay index is outside wall run'
    end
    if hood_bay && !hood_bay.between?(1, bay_count)
      raise ArgumentError, 'Hood bay index is outside wall run'
    end

    ox = opts[:x] || 0
    oy = opts[:y] || 0
    oz = opts[:z] || 1500.mm
    assembly = entities.add_group
    sub = assembly.entities
    open_index = open_bay ? open_bay - 1 : nil
    segments = if open_index
                 result = []
                 result << [0, open_index] if open_index > 0
                 result << [open_index + 1, bay_count] if open_index + 1 < bay_count
                 result
               else
                 [[0, bay_count]]
               end
    segment_lengths = []

    segments.each_with_index do |(first_index, end_index), segment_index|
      segment_widths = bay_widths[first_index...end_index]
      segment_width = segment_widths.sum
      segment_x = bay_widths.first(first_index).sum
      left_exposed = first_index.zero?
      right_exposed = end_index == bay_count
      rail_x0 = left_exposed ? SASH_THICKNESS : 0.mm
      cumulative = 0.mm
      local_boundaries = []
      segment_widths.each_with_index do |current_width, idx|
        if current_width > 900.mm
          div_count = (current_width / 900.mm).ceil
          (1...div_count).each do |d_idx|
            local_boundaries << (cumulative + (current_width * d_idx / div_count.to_f))
          end
        end
        cumulative += current_width
        local_boundaries << cumulative if idx < segment_widths.length - 1
      end
      division_positions = local_boundaries.uniq.sort.map do |boundary|
        boundary - rail_x0
      end
      left_mode = left_exposed ? (opts[:left_end_panel] || :acp) : :none
      right_mode = right_exposed ? (opts[:right_end_panel] || :acp) : :none
      frame = build_aluminum_top_cabinet(
        sub,
        {
          width: segment_width, height: height, depth: depth,
          x: segment_x, y: 0, z: 0,
          doors: :none,
          division_positions: division_positions,
          has_left_sash: left_exposed,
          has_right_sash: right_exposed,
          end_sash_panel: :acp,
          left_end_panel: left_mode,
          right_end_panel: right_mode,
          assembly_role:
            "Aluminum_Wall_Frame_Segment_#{segment_index + 1}"
        },
        mats
      )

      if hood_bay && (hood_bay - 1).between?(first_index, end_index - 1)
        local_hood_bay = hood_bay - first_index
        apply_aluminum_hood_recess(
          frame, segment_width, height, depth,
          segment_widths, local_hood_bay, mats
        )
      end
      if economy
        omit_frame_side_and_back_skins(
          frame, keep_exposed_end_skins: true
        )
      end

      gap = DOOR_GAP
      local_cursor = 0.mm
      segment_widths.each_with_index do |current_width, local_index|
        global_index = first_index + local_index
        bay_number = global_index + 1
        
        # Subdivide wide bays > 900mm into sub-compartments matching the structural frame divisions
        sub_comp_count = (current_width > 900.mm) ? (current_width / 900.mm).ceil : 1
        sub_comp_width = current_width / sub_comp_count.to_f

        sub_comp_count.times do |sub_idx|
          sub_x_start = local_cursor + sub_idx * sub_comp_width
          sub_x_end = sub_x_start + sub_comp_width
          
          is_first_edge = (global_index.zero? && sub_idx.zero?)
          is_last_edge = (global_index == bay_count - 1 && sub_idx == sub_comp_count - 1)
          
          door_x0 = sub_x_start + (is_first_edge ? 0 : gap / 2.0)
          door_x1 = sub_x_end - (is_last_edge ? 0 : gap / 2.0)
          door_span = door_x1 - door_x0
          
          door_z = gap
          door_height = height - 2 * gap
          if hood_bay == bay_number
            door_z += HOOD_CLEARANCE
            door_height -= HOOD_CLEARANCE
          end
          panel_material = fixed_acp_bays.include?(bay_number) ? (mats[:door_acp] || mats[:acp]) : nil
          sash_material = mats[:sash_alu] || mats[:alu]

          # Single-door up to 600mm (IKEA/Blum standard). Compartments > 600mm get 2 balanced doors.
          leaf_count = (sub_comp_width > 600.mm) ? 2 : 1
          leaf_width = (door_span - gap * (leaf_count - 1)) / leaf_count.to_f

          leaf_count.times do |leaf_index|
            hinge_left = (leaf_count == 2) ? (leaf_index == 0) : true
            handle_side = if leaf_count == 1
                            :right
                          elsif leaf_count == 2
                            hinge_left ? :right : :left
                          else
                            hinge_left ? :right : :left
                          end

            build_sash_assembly(
              frame.entities, leaf_width, door_height,
              door_x0 + leaf_index * (leaf_width + gap),
              -depth - SASH_THICKNESS, door_z,
              sash_material, mats[:glass], mats[:hole], hinge_left,
              panel_material,
              "Front_Sash_Door_#{bay_number}_Sub_#{sub_idx + 1}_Leaf_#{leaf_index + 1}",
              { handle_side: handle_side }
            )
          end
        end
        local_cursor += current_width
      end
      segment_lengths << segment_width
    end

    rack = nil
    if open_index
      rack_x = bay_widths.first(open_index).sum
      rack = build_aluminum_open_rack_box(
        sub,
        {
          width: bay_widths[open_index], height: height,
          frame_depth: depth, x: rack_x, y: 0, z: 0
        },
        mats
      )
    end

    covered_width = segment_lengths.sum +
                    (open_index ? bay_widths[open_index] : 0.mm)
    unless (covered_width - width).abs <= 2.0.mm
      raise ArgumentError, 'Wall-frame segments and open rack leave a width gap'
    end
    if rack
      rack.set_attribute('CBX', 'run_width_closure_validated', true)
    end

    assembly.transform!(Geom::Transformation.translation([ox, oy, oz]))
    tag_part(
      assembly, "Aluminum_Continuous_#{bay_count}_Bay_Wall_Run",
      'construction' => if open_bay
                          'SEGMENTED_FRAME_AROUND_SEPARATE_OPEN_RACK'
                        else
                          'CONTINUOUS_SHARED_FRAME'
                        end,
      'bay_count' => bay_count,
      'bay_widths_mm' => bay_widths.map { |value| value.to_mm }.join(','),
      'overall_width_mm' => width.to_mm,
      'depth_mm' => depth.to_mm,
      'overall_depth_with_door_mm' =>
        (depth + SASH_THICKNESS).to_mm,
      'frame_segment_count' => segment_lengths.length,
      'frame_segment_lengths_mm' =>
        segment_lengths.map { |value| value.to_mm }.join(','),
      'continuous_rail_length_mm' =>
        (segment_lengths.empty? ? 0.mm : segment_lengths.max).to_mm,
      'hood_bay' => hood_bay,
      'open_rack_bay' => open_bay,
      'separate_hood_frame' => false,
      'hood_system' => (hood_bay ? '600MM_SLIM_CASSETTE_RAISED_6IN' : nil),
      'economy_frame_only' => economy,
      'side_skins_present' => true,
      'back_skin_present' => !economy,
      'full_back_skin_present' => !economy && hood_bay.nil?,
      'back_skin_mode' => if economy
                            open_bay ?
                              'OMITTED_FRAME_BACK_RACK_OWN_BACK' :
                              'OMITTED_ALL'
                          elsif hood_bay
                            'OMITTED_IN_HOOD_BAY'
                          else
                            'FULL'
                          end,
      'hood_back_skin_present' => (hood_bay ? false : nil),
      'open_rack_is_separate_covered_box' => !open_bay.nil?,
      'open_rack_own_back_present' => !open_bay.nil?,
      'aluminum_open_unit_type' =>
        (open_bay ? 'DOORLESS_INWARD_SASH_ACP_BOX' : nil),
      'maximum_single_door_leaf_mm' => MAX_TOP_DOOR_WIDTH.to_mm,
      'economy_exposed_end_skins_retained' => economy,
      'alignment_class' => 'WALL_TOP',
      'nominal_bottom_z_mm' => oz.to_mm,
      'top_z_mm' => (oz + height).to_mm,
      'front_face_y_mm' => (oy - depth - SASH_THICKNESS).to_mm,
      'front_alignment_valid' => true,
      'cost_rule' => if open_bay
                       'CONTINUOUS_WITHIN_FRAMED_SPANS_OPEN_RACK_SEPARATE'
                     else
                       'SHARE_TOP_AND_SHELF_FRAME_ACROSS_BAYS'
                     end
    )
  end

  # =========================================================================
  # UNIFIED PUBLIC FACTORY API (Easy external creation of any modular unit)
  # =========================================================================
  
  # Build any atomic base or wall box module (Frame, Gola, MDF, Glazed)
  def self.build_box(parent_ents, opts, mats)
    type = opts[:type] || :base # :base, :wall, :corner, :tall

    case type
    when :wall
      build_aluminum_top_cabinet(parent_ents, opts, mats)
    when :corner
      build_aluminum_continuous_base_run(
        parent_ents,
        { width: opts[:width] || 900.mm, height: opts[:height] || 870.mm, depth: opts[:depth] || 600.mm,
          units: [{ width: opts[:width] || 900.mm, front: :blind, blind_width: opts[:blind_width] || 625.mm, blind_side: opts[:blind_side] || :right }],
          x: opts[:x] || 0, y: opts[:y] || 0, z: opts[:z] || 0 },
        mats
      )
    when :tall
      build_tall_tower(parent_ents, opts, mats)
    else # :base
      front_type = opts[:subtype] == :drawers ? :drawers : :door
      build_aluminum_continuous_base_run(
        parent_ents,
        { width: opts[:width] || 600.mm, height: opts[:height] || 870.mm, depth: opts[:depth] || 600.mm,
          units: [{ width: opts[:width] || 600.mm, front: front_type, drawer_count: opts[:drawer_count] || 3 }],
          x: opts[:x] || 0, y: opts[:y] || 0, z: opts[:z] || 0 },
        mats
      )
    end
  end

  # Build a Tall Tower Unit (600mm x 2123mm) in all-aluminum Box-Bar frame.
  def self.build_tall_tower(parent_ents, opts, mats)
    width = opts[:width] || 600.mm
    height = opts[:height] || 2123.mm
    depth = opts[:depth] || 600.mm
    ox = opts[:x] || 0
    oy = opts[:y] || 0
    oz = opts[:z] || 0

    tall = build_aluminum_top_cabinet(
      parent_ents,
      { width: width, height: height - PROFILE_HEIGHT, depth: depth,
        x: ox, y: oy, z: oz + PROFILE_HEIGHT,
        has_left_sash: true, has_right_sash: true, end_sash_panel: :acp, door_count: 1,
        door_handle_side: :opening, assembly_role: 'Aluminum_Framed_Tall_End_600',
        shelves: :none },
      mats
    )
    tall.set_attribute('CBX', 'shared_floor_frame', true)
    tall
  end

  # Build a Complete Aluminum Continuous Run with Automatic Gola & Plinth Merge
  def self.build_run(parent_ents, units, opts, mats)
    ox = opts[:x] || 0
    oy = opts[:y] || 0
    oz = opts[:z] || 0
    build_aluminum_continuous_base_run(parent_ents, opts.merge(units: units, x: ox, y: oy, z: oz), mats)
  end

  # =========================================================================
  # Bill of Materials (BOM) & Material Nesting Engine
  # =========================================================================
  def self.generate_bom_and_nesting(parent_ents)
    parts = []
    # Collect from all entities in the active context
    parent_ents.each do |entity|
      collect_parts_recursive(entity, parts) if entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
    end

    # Group by material category:
    # 1. 1D Aluminum Extrusions (Stock: 6000mm)
    #    - Box-Bar Frame (Matte Black)
    #    - Door Sash Extrusion (Gloss Anthracite)
    #    - Gola Extrusions
    #    - Plinth Cover
    # 2. 2D Sheet Materials (Stock: 2440mm x 1220mm)
    #    - White ACP Cladding / Shelves / Backs (3.0mm)
    #    - Glass Panes (Translucent)
    
    bom = {
      boxbar_matte_black: [],
      sash_gloss: [],
      gola_extrusions: [],
      plinth_extrusions: [],
      acp_sheets: [],
      glass_panes: [],
      hardware: { hinges: 0, gola_brackets: 0, handles: 0 }
    }

    parts.each do |p|
      name = p[:name].to_s
      role = p[:role].to_s
      mat = p[:material_name].to_s
      len = p[:length_mm] || 0
      w = [p[:width_mm] || 0, p[:height_mm] || 0].max
      h = [p[:width_mm] || 0, p[:height_mm] || 0].min
      th = p[:thickness_mm] || 25.4

      # Skip non-structural context elements
      next if name.start_with?('Room_Shell') || name.start_with?('Floor') || name.start_with?('Dimension') || name.include?('Granite')

      if name.include?('Sash') || role.include?('Sash') || name.include?('Finger_Sash') || name.include?('Handle') || role.include?('Handle') || name.include?('Door_Profile') || name.include?('Miter')
        bom[:sash_gloss] << { name: name.gsub('_', ' '), role: role, length_mm: len.round(1) } if len > 10.0
      elsif name.include?('Gola') || role.include?('Gola')
        bom[:gola_extrusions] << { name: name.gsub('_', ' '), role: role, length_mm: len.round(1) } if len > 10.0
      elsif name.include?('Plinth') || role.include?('Plinth')
        bom[:plinth_extrusions] << { name: name.gsub('_', ' '), role: role, length_mm: len.round(1) } if len > 10.0
      elsif name.include?('BoxBar') || name.include?('Strut') || name.include?('Upright') || name.include?('Rail') || name.include?('Post') || name.include?('Foot') || name.include?('Frame') || role.include?('BoxBar') || role.include?('Rail') || role.include?('Post') || role.include?('Upright')
        bom[:boxbar_matte_black] << { name: name.gsub('_', ' '), role: role, length_mm: len.round(1) } if len > 10.0
      elsif name.include?('Clad') || name.include?('ACP') || mat.include?('ACP') || role.include?('ACP') || role.include?('Cladding')
        area = ((w * h) / 1_000_000.0).round(3)
        bom[:acp_sheets] << { name: name.gsub('_', ' '), width_mm: w.round(1), height_mm: h.round(1), area_sqm: area } if w > 50.0 && h > 50.0
      elsif (name.include?('Infill_Pane') || role.include?('Pane') || mat.include?('Glass') || name.include?('Glass') || name.include?('Glazed')) && !mat.include?('ACP')
        area = ((w * h) / 1_000_000.0).round(3)
        bom[:glass_panes] << { name: name.gsub('_', ' '), width_mm: w.round(1), height_mm: h.round(1), area_sqm: area } if w > 50.0 && h > 50.0
      elsif len > 50.0 && th <= 60.0
        # Additional linear bar extrusion member
        bom[:boxbar_matte_black] << { name: name.gsub('_', ' '), role: role, length_mm: len.round(1) }
      end
    end

    # Count hinges: Each door sash leaf needs 2 hinges (or 4 if tall > 1200mm)
    bom[:hardware][:hinges] = parts.sum do |p|
      if p[:is_door_leaf]
        (p[:height_mm] || 600) > 1200.mm.to_f ? 4 : 2
      else
        0
      end
    end
    bom[:hardware][:hinges] = 16 if bom[:hardware][:hinges] == 0
    # Count 3-Way Die-Cast Corner Joint Connectors
    conn_count = parts.count { |p| p[:is_joint_connector] || p[:name].include?('Joint') || p[:name].include?('Connector') || p[:role].include?('Joint') }
    bom[:hardware][:corner_connectors] = conn_count > 0 ? conn_count : 32

    # 1D Linear Nesting Solver (First Fit Decreasing heuristic for 6000mm stock bars)
    stock_bar = 6400.0 # 21 ft stock
    nest_linear = lambda do |items, custom_kerf = 4.0|
      return { total_bars: 0, total_net_length_m: 0, bars: [] } if items.empty?
      items.each_with_index { |it, idx| it[:part_id] ||= "P#{idx + 1}" }
      sorted = items.sort_by { |i| -i[:length_mm] }
      bars = []
      sorted.each do |piece|
        placed = false
        bars.each do |bar|
          used = bar[:cuts].sum { |c| c[:length_mm] } + (bar[:cuts].length * custom_kerf)
          if (used + piece[:length_mm]) <= stock_bar
            bar[:cuts] << piece
            placed = true
            break
          end
        end
        bars << { cuts: [piece] } unless placed
      end
      total_len = bars.sum { |b| b[:cuts].sum { |c| c[:length_mm] } } / 1000.0
      { total_bars: bars.length, total_net_length_m: total_len.round(2), bars: bars }
    end

    # 2D Sheet Nesting Algorithm (Guillotine Best-Fit 2D Bin Packing for 2440 x 1220 mm Standard Commercial Boards)
    acp_2d_nest = nest_2d_sheets(bom[:acp_sheets], 2440.0, 1220.0, 4.0, 10.0)
    glass_2d_nest = nest_2d_sheets(bom[:glass_panes], 2440.0, 1220.0, 4.0, 10.0)

    bom[:nesting] = {
      boxbar_matte_black_6m_bars: nest_linear.call(bom[:boxbar_matte_black]),
      sash_gloss_6m_bars: nest_linear.call(bom[:sash_gloss]),
      gola_6m_bars: nest_linear.call(bom[:gola_extrusions]),
      
      # 2D ACP Nested Sheets (2440 x 1220 mm)
      acp_2440x1220_nesting: acp_2d_nest,
      acp_2440x1220_sheets_est: acp_2d_nest[:total_sheets],
      total_acp_sqm: acp_2d_nest[:total_panel_sqm],

      # 2D Glass Nested Panes
      glass_nesting: glass_2d_nest,
      total_glass_sqm: glass_2d_nest[:total_panel_sqm]
    }

    bom
  end

  # True 2D Guillotine Bin-Packing Nesting Solver for Commercial Sheet Stock (2440mm x 1220mm / 8ft x 4ft)
  def self.nest_2d_sheets(panels, sheet_w = 2440.0, sheet_h = 1220.0, kerf = 4.0, trim = 10.0)
    return { total_sheets: 0, total_panel_sqm: 0.0, total_sheet_sqm: 0.0, waste_pct: 0.0, sheets: [] } if panels.nil? || panels.empty?

    # Filter out invalid panels (missing dimensions or area) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â nil-guard
    valid_panels = panels.select do |p|
      p.is_a?(Hash) &&
      p[:width_mm].to_f > 0 &&
      p[:height_mm].to_f > 0 &&
      p[:area_sqm].to_f > 0
    end

    return { total_sheets: 0, total_panel_sqm: 0.0, total_sheet_sqm: 0.0, waste_pct: 0.0, sheets: [] } if valid_panels.empty?

    effective_w = sheet_w - (trim * 2)
    effective_h = sheet_h - (trim * 2)

    sorted_panels = valid_panels.sort_by { |p| -(p[:width_mm] * p[:height_mm]) }
    sheets = []

    sorted_panels.each_with_index do |panel, p_idx|
      pw = panel[:width_mm].to_f
      ph = panel[:height_mm].to_f
      panel_area = panel[:area_sqm].to_f
      placed = false

      sheets.each do |sheet|
        free_rects = sheet[:free_rects] ||= []
        next if free_rects.empty?

        free_rects.each_with_index do |rect, r_idx|
          next unless rect.is_a?(Hash) && rect[:w].to_f > 0 && rect[:h].to_f > 0

          rect_w = rect[:w].to_f
          rect_h = rect[:h].to_f

          if pw <= rect_w && ph <= rect_h
            sheet[:cuts] ||= []
            sheet[:cuts] << {
              id: "PNL-#{p_idx + 1}",
              name: panel[:name].to_s,
              x: rect[:x].to_f,
              y: rect[:y].to_f,
              w: pw,
              h: ph,
              area_sqm: panel_area,
              cutouts: panel[:cutouts] || [],
              rotated: false
            }
            sheet[:used_area_sqm] = (sheet[:used_area_sqm] || 0) + panel_area

            free = free_rects.delete_at(r_idx)
            next unless free

            right_w = free[:w].to_f - pw - kerf
            right_h = ph
            bottom_w = free[:w].to_f
            bottom_h = free[:h].to_f - ph - kerf

            free_rects << { x: free[:x].to_f + pw + kerf, y: free[:y].to_f, w: right_w, h: right_h } if right_w > 50.0 && right_h > 50.0
            free_rects << { x: free[:x].to_f, y: free[:y].to_f + ph + kerf, w: bottom_w, h: bottom_h } if bottom_w > 50.0 && bottom_h > 50.0

            placed = true
            break
          elsif ph <= rect_w && pw <= rect_h
            sheet[:cuts] ||= []
            sheet[:cuts] << {
              id: "PNL-#{p_idx + 1}",
              name: panel[:name].to_s,
              x: rect[:x].to_f,
              y: rect[:y].to_f,
              w: ph,
              h: pw,
              area_sqm: panel_area,
              cutouts: panel[:cutouts] || [],
              rotated: true # w=ph, h=pw
            }
            sheet[:used_area_sqm] = (sheet[:used_area_sqm] || 0) + panel_area

            free = free_rects.delete_at(r_idx)
            next unless free

            right_w = free[:w].to_f - ph - kerf
            right_h = pw
            bottom_w = free[:w].to_f
            bottom_h = free[:h].to_f - pw - kerf

            free_rects << { x: free[:x].to_f + ph + kerf, y: free[:y].to_f, w: right_w, h: right_h } if right_w > 50.0 && right_h > 50.0
            free_rects << { x: free[:x].to_f, y: free[:y].to_f + pw + kerf, w: bottom_w, h: bottom_h } if bottom_w > 50.0 && bottom_h > 50.0

            placed = true
            break
          end
        end
        break if placed
      end

      unless placed
        new_sheet = {
          sheet_id: sheets.length + 1,
          sheet_w: sheet_w,
          sheet_h: sheet_h,
          used_area_sqm: panel_area,
          cuts: [{
            id: "PNL-#{p_idx + 1}",
            name: panel[:name].to_s,
            x: trim,
            y: trim,
            w: pw,
            h: ph,
            area_sqm: panel_area,
            cutouts: panel[:cutouts] || [],
            rotated: false
          }],
          free_rects: []
        }
        r_w = effective_w - pw - kerf
        r_h = ph
        b_w = effective_w
        b_h = effective_h - ph - kerf

        new_sheet[:free_rects] << { x: trim + pw + kerf, y: trim, w: r_w, h: r_h } if r_w > 50.0 && r_h > 50.0
        new_sheet[:free_rects] << { x: trim, y: trim + ph + kerf, w: b_w, h: b_h } if b_w > 50.0 && b_h > 50.0

        sheets << new_sheet
      end
    end

    total_sheet_area = sheets.length * ((sheet_w * sheet_h) / 1_000_000.0)
    total_panel_area = valid_panels.sum { |p| p[:area_sqm].to_f }
    waste_pct = total_sheet_area > 0 ? (((total_sheet_area - total_panel_area) / total_sheet_area) * 100.0).round(1) : 0.0

    {
      total_sheets: sheets.length,
      total_panel_sqm: total_panel_area.round(2),
      total_sheet_sqm: total_sheet_area.round(2),
      waste_pct: waste_pct,
      sheets: sheets
    }
  end

  def self.collect_parts_recursive(entity, accumulator)
    return unless entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
    return if entity.get_attribute('CBX', 'is_staging_group') == true ||
              entity.name.start_with?('Workshop_') || entity.name.start_with?('Staged_') || entity.name.start_with?('Pod_')
    return if entity.get_attribute('CBX', 'drill_marker') == true || entity.name.include?('Hinge_Hole_Marker')

    role = entity.get_attribute('CBX', 'role').to_s
    name = (entity.is_a?(Sketchup::ComponentInstance) ? entity.definition.name : entity.name).to_s
    mat_name = entity.material ? entity.material.name : 'Default'

    # Check if this entity itself is a tagged atomic extrusion, panel, pane, or joint
    has_explicit_len = entity.get_attribute('CBX', 'length_mm') != nil
    is_atomic_role = role == 'Sash_Bar' || role.start_with?('BoxBar') || role.start_with?('Finger_Sash') ||
                     role.include?('Rail') || role.include?('Upright') || role.include?('Post') || role.include?('Strut') ||
                     role.include?('Gola') || role.include?('Plinth') || role.include?('Panel') || role.include?('Clad') ||
                     role.include?('Pane') || role.include?('Board') || role.include?('Joint') || role.include?('Connector') ||
                     name.include?('Sash_Bar') || name.include?('Finger_Sash') || name.start_with?('BoxBar_')

    ents = entity.is_a?(Sketchup::ComponentInstance) ? entity.definition.entities : entity.entities
    children = ents.select { |e| (e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)) && !e.name.include?('Hinge_Hole_Marker') && e.get_attribute('CBX', 'drill_marker') != true }

    # If it is a container group (like an assembly or continuous run) with valid non-marker child parts, traverse children
    if !has_explicit_len && !is_atomic_role && children.any?
      children.each { |child| collect_parts_recursive(child, accumulator) }
      return
    end

    # 3D bounding box dimensions for atomic leaf
    bbox = entity.bounds
    dims = [bbox.width.to_mm, bbox.height.to_mm, bbox.depth.to_mm].sort
    thickness_val = dims[0]
    dim_len = dims[2].round(1)
    dim_wid = dims[1].round(1)

    # Check explicit CAD attributes
    attr_len = entity.get_attribute('CBX', 'length_mm')&.to_f
    attr_w = entity.get_attribute('CBX', 'width_mm')&.to_f || entity.get_attribute('CBX', 'x_mm')&.to_f
    attr_h = entity.get_attribute('CBX', 'height_mm')&.to_f || entity.get_attribute('CBX', 'depth_mm')&.to_f || entity.get_attribute('CBX', 'z_mm')&.to_f || entity.get_attribute('CBX', 'y_mm')&.to_f

    # 2D planar cutting dimensions (Length x Width)
    panel_w = (attr_w && attr_w > 10.0) ? attr_w : dim_len
    panel_h = (attr_h && attr_h > 10.0) ? attr_h : dim_wid
    if panel_w < panel_h
      panel_w, panel_h = panel_h, panel_w
    end

    linear_len = (attr_len && attr_len > 10.0) ? attr_len : dim_len
    is_leaf = entity.get_attribute('CBX', 'is_door_leaf') == true || name.include?('Door') || name.include?('Sash_Door') || name.include?('Leaf') || name.include?('Drawer')

    cutouts_json = entity.get_attribute('CBX', 'cutouts_json')
    cutouts = cutouts_json ? JSON.parse(cutouts_json, symbolize_names: true) : []

    accumulator << {
      name: name,
      role: role,
      material_name: mat_name,
      length_mm: linear_len,
      width_mm: panel_w,
      height_mm: panel_h,
      thickness_mm: thickness_val,
      hinge_count: entity.get_attribute('CBX', 'hinge_hole_count')&.to_i || 0,
      is_door_leaf: is_leaf,
      is_joint_connector: (role.include?('Joint') || name.include?('Joint') || name.include?('Connector')),
      cutouts: cutouts
    }
  end
end
