extends Node2D

# Define custom signals that this scene can emit.
signal scored
signal hit

# The speed at which the pipes will move. This will be set by the main scene.
var scroll_speed = 150.0
var is_moving = true

func stop_moving():
	is_moving = false

func _ready():
	# Adds this specific pipe instance to the "pipes" group
	add_to_group("pipes")

func _process(delta):
	if is_moving:
		# Move the pipe to the left based on the scroll speed.
		position.x -= scroll_speed * delta

		# If the pipe moves off-screen, delete it to free up memory.
		if position.x < -150:
			queue_free()


# This function is connected via the editor to the body_entered signal
# of the Area2D nodes for the top and bottom pipes.
func _on_pipe_body_entered(body):
	# When a body enters the pipe's collision shape, we emit the "hit" signal.
	hit.emit()


# This function is connected via the editor to the body_entered signal
# of the ScoreArea Area2D node.
func _on_score_area_body_entered(body):
	# When a body enters the scoring area, we emit the "scored" signal.
	# We also disable the score area's collision to ensure the signal is only
	# sent once per pipe.
	$ScoreArea/CollisionShape2D.set_deferred("disabled", true)
	scored.emit()
